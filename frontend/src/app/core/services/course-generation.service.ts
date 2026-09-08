import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CourseGenTask {
  id: string;
  topic: string;
  targetAudience: string;
  additionalInfo?: string;
  status: 'pending' | 'analyzing' | 'structuring' | 'generating' | 'completed' | 'error';
  progress: number;
  statusText: string;
  subjectId?: string;
  error?: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class CourseGenerationService {
  private readonly STORAGE_KEY = 'eduai_course_gen_tasks';
  private tasksSubject = new BehaviorSubject<CourseGenTask[]>([]);
  public tasks$: Observable<CourseGenTask[]> = this.tasksSubject.asObservable();

  constructor(private apiService: ApiService) {
    this.loadFromStorage();
  }

  get tasks(): CourseGenTask[] {
    return this.tasksSubject.value;
  }

  private saveToStorage(tasks: CourseGenTask[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Failed to save course generation tasks to storage', e);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed: CourseGenTask[] = JSON.parse(stored);
        const now = Date.now();
        const valid = parsed.filter(t => (now - t.createdAt) < 24 * 3600 * 1000);
        this.tasksSubject.next(valid);
      }
    } catch (e) {
      console.warn('Failed to load course generation tasks from storage', e);
    }
  }

  registerCustomTask(task: CourseGenTask): string {
    const currentTasks = [task, ...this.tasksSubject.value.filter(t => t.id !== task.id)];
    this.tasksSubject.next(currentTasks);
    this.saveToStorage(currentTasks);
    return task.id;
  }

  startGeneration(topic: string, targetAudience: string = 'Beginners', additionalInfo?: string): string {
    const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const newTask: CourseGenTask = {
      id: taskId,
      topic: topic.trim(),
      targetAudience,
      additionalInfo,
      status: 'analyzing',
      progress: 15,
      statusText: 'Анализ темы и концепции...',
      createdAt: Date.now()
    };

    const currentTasks = [newTask, ...this.tasksSubject.value];
    this.tasksSubject.next(currentTasks);
    this.saveToStorage(currentTasks);

    const t1 = setTimeout(() => {
      this.updateTask(taskId, {
        status: 'structuring',
        progress: 45,
        statusText: 'Проектирование структуры и модулей...'
      });
    }, 4000);

    const t2 = setTimeout(() => {
      this.updateTask(taskId, {
        status: 'generating',
        progress: 75,
        statusText: 'Генерация уроков и учебных текстов...'
      });
    }, 12000);

    this.apiService.generateCourse(topic, additionalInfo).subscribe({
      next: (res: any) => {
        clearTimeout(t1);
        clearTimeout(t2);
        const subjectId = res.subject_id || res.id;
        this.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          statusText: 'Курс готов!',
          subjectId
        });
      },
      error: (err: any) => {
        clearTimeout(t1);
        clearTimeout(t2);
        const errorMsg = err.error?.detail || err.message || 'Не удалось сгенерировать курс';
        this.updateTask(taskId, {
          status: 'error',
          statusText: 'Ошибка генерации курса',
          error: errorMsg
        });
      }
    });

    return taskId;
  }

  retryTask(taskId: string) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    this.removeTask(taskId);
    this.startGeneration(task.topic, task.targetAudience, task.additionalInfo);
  }

  updateTask(taskId: string, patch: Partial<CourseGenTask>) {
    const updated = this.tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, ...patch };
      }
      return t;
    });
    this.tasksSubject.next(updated);
    this.saveToStorage(updated);
  }

  removeTask(taskId: string) {
    const updated = this.tasks.filter(t => t.id !== taskId);
    this.tasksSubject.next(updated);
    this.saveToStorage(updated);
  }

  clearFinished() {
    const updated = this.tasks.filter(t => t.status !== 'completed' && t.status !== 'error');
    this.tasksSubject.next(updated);
    this.saveToStorage(updated);
  }
}
