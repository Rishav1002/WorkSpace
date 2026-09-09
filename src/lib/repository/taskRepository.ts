import { TaskItem } from '../../types';
import { offlineDB } from '../offline/db';
import { supabase, isSupabaseConfigured } from '../supabase';
import { syncRepository } from './syncRepository';

export class TaskRepository {
  async getTasks(userId: string): Promise<TaskItem[]> {
    const cached = await offlineDB.taskItems.where('userId').equals(userId).toArray();

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('task_items')
          .select('*')
          .eq('user_id', userId)
          .order('due_date', { ascending: true });

        if (!error && data) {
          const serverTasks: TaskItem[] = data.map(r => ({
            id: r.id,
            userId: r.user_id,
            courseCode: r.course_code,
            title: r.title,
            description: r.description,
            dueDate: r.due_date,
            dueTime: r.due_time,
            priority: r.priority,
            status: r.status,
            isRecurring: r.is_recurring,
            recurrenceRule: r.recurrence_rule,
            completedAt: r.completed_at,
            updatedAt: r.updated_at
          }));
          await offlineDB.taskItems.bulkPut(serverTasks);
          return serverTasks;
        }
      } catch (err) {
        console.warn('Network error fetching tasks from Supabase:', err);
      }
    }

    return cached;
  }

  async addTask(userId: string, taskData: Omit<TaskItem, 'id' | 'userId' | 'updatedAt'>): Promise<TaskItem> {
    const newTask: TaskItem = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      updatedAt: new Date().toISOString()
    };

    await offlineDB.taskItems.put(newTask);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'task',
      entityId: newTask.id,
      operation: 'CREATE',
      payload: newTask
    });

    return newTask;
  }

  async updateTask(userId: string, taskId: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
    const existing = await offlineDB.taskItems.get(taskId);
    if (!existing) return null;

    const updatedTask: TaskItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await offlineDB.taskItems.put(updatedTask);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'task',
      entityId: taskId,
      operation: 'UPDATE',
      payload: updatedTask
    });

    return updatedTask;
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    await offlineDB.taskItems.delete(taskId);

    await syncRepository.enqueueMutation({
      userId,
      entityType: 'task',
      entityId: taskId,
      operation: 'DELETE',
      payload: { id: taskId, userId }
    });
  }

  async toggleTaskComplete(userId: string, taskId: string): Promise<TaskItem | null> {
    const existing = await offlineDB.taskItems.get(taskId);
    if (!existing) return null;

    const isNowDone = existing.status !== 'DONE';
    const nextStatus = isNowDone ? 'DONE' : 'TODO';
    const completedAt = isNowDone ? new Date().toISOString() : undefined;

    return await this.updateTask(userId, taskId, {
      status: nextStatus,
      completedAt
    });
  }
}

export const taskRepository = new TaskRepository();
