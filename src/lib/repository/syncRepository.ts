import { offlineDB, SyncQueueItem, SyncConflictItem } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';

export type SyncStatus = 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'PENDING' | 'CONFLICT' | 'ERROR';

const MAX_RETRIES_DEFAULT = 5;

class SyncRepository {
  private isProcessing = false;

  constructor() {
    // Listen for online reconnect to trigger automatic background retry
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue(true).catch(err => {
          console.warn('Auto-retry on reconnect encountered an error:', err);
        });
      });
    }
  }

  async enqueueMutation(
    data: Omit<SyncQueueItem, 'id' | 'createdAt' | 'updatedAt' | 'attemptCount' | 'status'>
  ): Promise<SyncQueueItem> {
    const queueItem: SyncQueueItem = {
      ...data,
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attemptCount: 0,
      maxRetries: MAX_RETRIES_DEFAULT,
      status: 'PENDING'
    };

    await offlineDB.syncQueue.put(queueItem);

    // If online & Supabase configured, trigger processing automatically in background
    if (navigator.onLine && isSupabaseConfigured) {
      this.processQueue().catch(err => {
        console.warn('Background sync attempt failed:', err);
      });
    }

    return queueItem;
  }

  async getPendingCount(): Promise<number> {
    return await offlineDB.syncQueue
      .where('status')
      .anyOf(['PENDING', 'FAILED'])
      .count();
  }

  async getSyncStatus(): Promise<SyncStatus> {
    if (!navigator.onLine) return 'OFFLINE';
    if (this.isProcessing) return 'SYNCING';

    const conflicts = await offlineDB.syncConflicts.where('status').equals('unresolved').count();
    if (conflicts > 0) return 'CONFLICT';

    const pending = await offlineDB.syncQueue.where('status').equals('PENDING').count();
    if (pending > 0) return 'PENDING';

    const failed = await offlineDB.syncQueue
      .where('status')
      .anyOf(['FAILED', 'PERMANENTLY_FAILED'])
      .count();
    if (failed > 0) return 'ERROR';

    return 'SYNCED';
  }

  async getConflicts(userId?: string): Promise<SyncConflictItem[]> {
    if (userId) {
      return await offlineDB.syncConflicts
        .where('userId')
        .equals(userId)
        .and(c => c.status === 'unresolved')
        .toArray();
    }
    return await offlineDB.syncConflicts.where('status').equals('unresolved').toArray();
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'client' | 'server' | 'merge',
    mergedPayload?: any
  ): Promise<void> {
    const conflict = await offlineDB.syncConflicts.get(conflictId);
    if (!conflict) return;

    if (resolution === 'client' || resolution === 'merge') {
      const finalPayload = resolution === 'merge' ? mergedPayload : conflict.clientVersion;
      await this.enqueueMutation({
        userId: conflict.userId,
        entityType: conflict.entityType as any,
        entityId: conflict.entityId,
        operation: 'UPDATE',
        payload: {
          ...finalPayload,
          updatedAt: new Date().toISOString()
        }
      });
    }

    await offlineDB.syncConflicts.update(conflictId, {
      status: resolution === 'client' ? 'resolved_client' : resolution === 'server' ? 'resolved_server' : 'resolved_merged'
    });
  }

  /**
   * Manual retry method to re-queue failed and permanently failed items immediately
   */
  async retryFailedMutations(): Promise<{ processed: number; errors: number; conflicts: number }> {
    const failedItems = await offlineDB.syncQueue
      .where('status')
      .anyOf(['FAILED', 'PERMANENTLY_FAILED'])
      .toArray();

    for (const item of failedItems) {
      await offlineDB.syncQueue.update(item.id, {
        status: 'PENDING',
        attemptCount: 0,
        nextRetryAt: undefined,
        lastError: undefined
      });
    }

    return await this.processQueue(true);
  }

  async processQueue(forceRetryAll: boolean = false): Promise<{ processed: number; errors: number; conflicts: number }> {
    if (this.isProcessing) return { processed: 0, errors: 0, conflicts: 0 };
    if (!navigator.onLine || !isSupabaseConfigured || !supabase) {
      return { processed: 0, errors: 0, conflicts: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let errors = 0;
    let conflicts = 0;

    try {
      const nowMs = Date.now();
      const allQueue = await offlineDB.syncQueue.toArray();

      const itemsToProcess = allQueue.filter(item => {
        if (item.status === 'PENDING') return true;
        if (item.status === 'FAILED') {
          if (forceRetryAll) return true;
          const maxRetries = item.maxRetries || MAX_RETRIES_DEFAULT;
          if (item.attemptCount >= maxRetries) return false;
          if (!item.nextRetryAt) return true;
          return new Date(item.nextRetryAt).getTime() <= nowMs;
        }
        return false;
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (const item of itemsToProcess) {
        try {
          const nextAttemptCount = item.attemptCount + 1;
          await offlineDB.syncQueue.update(item.id, {
            status: 'SYNCING',
            attemptCount: nextAttemptCount,
            updatedAt: new Date().toISOString()
          });

          // Route mutation to corresponding Supabase table with optimistic concurrency check
          const result = await this.dispatchToSupabaseWithConcurrency(item);

          if (result.status === 'SUCCESS') {
            await offlineDB.syncQueue.update(item.id, {
              status: 'SYNCED',
              updatedAt: new Date().toISOString()
            });
            processed++;
            // Clean up synced items older than 1 minute to keep DB light
            await offlineDB.syncQueue.delete(item.id);
          } else if (result.status === 'CONFLICT') {
            conflicts++;
            await offlineDB.syncQueue.update(item.id, {
              status: 'CONFLICT',
              lastError: 'Optimistic concurrency conflict detected',
              updatedAt: new Date().toISOString()
            });
          } else {
            errors++;
            const maxRetries = item.maxRetries || MAX_RETRIES_DEFAULT;
            const isExhausted = nextAttemptCount >= maxRetries;
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s (capped at 60s)
            const backoffSeconds = Math.min(60, Math.pow(2, nextAttemptCount));
            const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();

            await offlineDB.syncQueue.update(item.id, {
              status: isExhausted ? 'PERMANENTLY_FAILED' : 'FAILED',
              nextRetryAt: nextRetry,
              lastError: result.error || 'Server rejected mutation',
              updatedAt: new Date().toISOString()
            });
          }
        } catch (itemErr: any) {
          errors++;
          console.error(`Error processing sync queue item ${item.id}:`, itemErr);
          const nextAttemptCount = item.attemptCount + 1;
          const maxRetries = item.maxRetries || MAX_RETRIES_DEFAULT;
          const isExhausted = nextAttemptCount >= maxRetries;
          const backoffSeconds = Math.min(60, Math.pow(2, nextAttemptCount));
          const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();

          await offlineDB.syncQueue.update(item.id, {
            status: isExhausted ? 'PERMANENTLY_FAILED' : 'FAILED',
            nextRetryAt: nextRetry,
            lastError: itemErr.message || 'Network communication error',
            updatedAt: new Date().toISOString()
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, errors, conflicts };
  }

  /**
   * Concurrency-safe Supabase dispatcher.
   * Compares server version timestamp against client version before writing.
   */
  private async dispatchToSupabaseWithConcurrency(
    item: SyncQueueItem
  ): Promise<{ status: 'SUCCESS' | 'CONFLICT' | 'ERROR'; error?: string }> {
    if (!supabase) return { status: 'ERROR', error: 'Supabase client not initialized' };

    switch (item.entityType) {
      case 'attendance_record': {
        const payload = item.payload;
        if (item.operation === 'DELETE') {
          const { error } = await supabase.from('attendance_records').delete().eq('id', item.entityId);
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        } else {
          // Check server version for optimistic concurrency
          if (item.operation === 'UPDATE') {
            const { data: serverRow } = await supabase
              .from('attendance_records')
              .select('*')
              .eq('id', payload.id)
              .maybeSingle();

            if (serverRow && serverRow.updated_at && payload.updatedAt) {
              if (new Date(serverRow.updated_at).getTime() > new Date(payload.updatedAt).getTime()) {
                // Record Conflict
                await offlineDB.syncConflicts.put({
                  id: `conf-att-${Date.now()}-${payload.id}`,
                  userId: payload.userId,
                  entityType: 'attendance_record',
                  entityId: payload.id,
                  clientVersion: payload,
                  serverVersion: serverRow,
                  status: 'unresolved',
                  createdAt: new Date().toISOString()
                });
                return { status: 'CONFLICT' };
              }
            }
          }

          const { error } = await supabase.from('attendance_records').upsert({
            id: payload.id,
            user_id: payload.userId,
            occurrence_key: payload.occurrenceKey,
            course_code: payload.courseCode,
            date_str: payload.dateStr,
            start_time: payload.startTime,
            status: payload.status,
            source: payload.source || 'manual',
            updated_at: payload.updatedAt || new Date().toISOString(),
            is_synced: true
          });
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        }
      }

      case 'task': {
        const payload = item.payload;
        if (item.operation === 'DELETE') {
          const { error } = await supabase.from('task_items').delete().eq('id', item.entityId);
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        } else {
          if (item.operation === 'UPDATE') {
            const { data: serverRow } = await supabase
              .from('task_items')
              .select('*')
              .eq('id', payload.id)
              .maybeSingle();

            if (serverRow && serverRow.updated_at && payload.updatedAt) {
              if (new Date(serverRow.updated_at).getTime() > new Date(payload.updatedAt).getTime()) {
                await offlineDB.syncConflicts.put({
                  id: `conf-task-${Date.now()}-${payload.id}`,
                  userId: payload.userId,
                  entityType: 'task',
                  entityId: payload.id,
                  clientVersion: payload,
                  serverVersion: serverRow,
                  status: 'unresolved',
                  createdAt: new Date().toISOString()
                });
                return { status: 'CONFLICT' };
              }
            }
          }

          const { error } = await supabase.from('task_items').upsert({
            id: payload.id,
            user_id: payload.userId,
            course_code: payload.courseCode,
            title: payload.title,
            description: payload.description,
            due_date: payload.dueDate,
            due_time: payload.dueTime,
            priority: payload.priority,
            status: payload.status,
            is_recurring: payload.isRecurring,
            recurrence_rule: payload.recurrenceRule,
            completed_at: payload.completedAt,
            updated_at: payload.updatedAt || new Date().toISOString()
          });
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        }
      }

      case 'timetable_override': {
        const payload = item.payload;
        if (item.operation === 'DELETE') {
          const { error } = await supabase.from('timetable_overrides').delete().eq('id', item.entityId);
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        } else {
          const { error } = await supabase.from('timetable_overrides').upsert({
            id: payload.id,
            user_id: payload.userId,
            original_slot_id: payload.originalSlotId,
            date_str: payload.dateStr,
            effective_from: payload.effectiveFrom,
            scope: payload.scope,
            override_type: payload.overrideType,
            course_code: payload.courseCode,
            day: payload.day,
            start_time: payload.startTime,
            end_time: payload.endTime,
            room: payload.room,
            teacher: payload.teacher,
            is_active: payload.isActive,
            updated_at: new Date().toISOString()
          });
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        }
      }

      case 'calendar_event': {
        const payload = item.payload;
        if (item.operation === 'DELETE') {
          const { error } = await supabase.from('calendar_events').delete().eq('id', item.entityId);
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        } else {
          const { error } = await supabase.from('calendar_events').upsert({
            id: payload.id,
            user_id: payload.userId,
            title: payload.title,
            date_str: payload.dateStr,
            end_date_str: payload.endDateStr,
            category: payload.category,
            is_official: payload.isOfficial || false,
            exam_category: payload.examCategory,
            course_code: payload.courseCode,
            start_time: payload.startTime,
            end_time: payload.endTime,
            class_impact: payload.classImpact || 'none',
            cancelled_slots: payload.cancelledSlots,
            description: payload.description,
            updated_at: new Date().toISOString()
          });
          return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
        }
      }

      case 'profile': {
        const payload = item.payload;
        const { error } = await supabase.from('user_profiles').upsert({
          id: payload.id,
          gr_number: payload.grNumber,
          display_name: payload.displayName,
          email: payload.email,
          role: payload.role,
          program: payload.program,
          group: payload.group,
          semester: payload.semester,
          section: payload.section,
          hostel: payload.hostel,
          hostel_room: payload.hostelRoom,
          phone: payload.phone,
          attendance_target: payload.attendanceTarget,
          class_start_date: payload.classStartDate,
          active_term_id: payload.activeTermId,
          recovery_pin_hash: payload.recoveryPinHash,
          scheduled_deletion_at: payload.scheduledDeletionAt,
          updated_at: new Date().toISOString()
        });
        return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
      }

      case 'audit_log': {
        const payload = item.payload;
        // The secure server-side RPC record_audit_log is mandatory for all administrative audit writes
        try {
          const { error: rpcError } = await supabase.rpc('record_audit_log', {
            p_entity: payload.entity,
            p_entity_id: payload.entityId,
            p_change_type: payload.changeType,
            p_previous_value: payload.previousValue || null,
            p_new_value: payload.newValue || null,
            p_scope: payload.scope || 'master',
            p_effective_date: payload.effectiveDate || new Date().toISOString().split('T')[0]
          });

          if (rpcError) {
            return {
              status: 'ERROR',
              error: `Audit log write failed: ${rpcError.message}. (record_audit_log RPC required).`
            };
          }
          return { status: 'SUCCESS' };
        } catch (err) {
          return {
            status: 'ERROR',
            error: `Failed to execute record_audit_log RPC: ${err instanceof Error ? err.message : String(err)}`
          };
        }
      }

      case 'notification_settings': {
        const payload = item.payload;
        const { error } = await supabase.from('user_notification_settings').upsert({
          user_id: item.userId,
          settings: payload,
          updated_at: new Date().toISOString()
        });
        return error ? { status: 'ERROR', error: error.message } : { status: 'SUCCESS' };
      }

      default:
        return { status: 'SUCCESS' };
    }
  }
}

export const syncRepository = new SyncRepository();
