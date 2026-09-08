import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = '/api';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) { }


  getUserById(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/users/${id}`);
  }

  getUserByName(name: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/users/by-name/${encodeURIComponent(name)}`);
  }

  createUser(name: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/users`, { name });
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/users/${id}`);
  }

  updateUser(id: string, userUpdate: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/users/${id}`, userUpdate);
  }

  uploadAvatar(id: string, formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/users/${id}/avatar`, formData);
  }

  uploadNewsImage(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/news/upload-image`, formData);
  }

  // Subjects
  getSubjects(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/subjects`);
  }

  getSubject(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/subjects/${id}`);
  }

  createSubject(name: string, description?: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects`, { name, description: description || null });
  }

  cloneSubject(id: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${id}/clone`, {});
  }

  deleteSubject(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/subjects/${id}`);
  }

  uploadSubjectCover(subjectId: string, formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${subjectId}/cover`, formData);
  }

  getSubjectTeachers(subjectId: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/subjects/${subjectId}/teachers`);
  }

  addSubjectTeacher(subjectId: string, userName: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${subjectId}/teachers`, { user_name: userName });
  }

  removeSubjectTeacher(subjectId: string, userName: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/subjects/${subjectId}/teachers/${userName}`);
  }

  markLessonViewed(subjectId: string, lessonId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${subjectId}/lessons/${lessonId}/view`, {});
  }

  getLessonProgress(subjectId: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/subjects/${subjectId}/progress`);
  }

  enrollInSubject(subjectId: string, payload: { user_name: string }): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${subjectId}/members`, payload);
  }

  getSubjectStudents(subjectId: string): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/subjects/${subjectId}/students`);
  }

  getStudentGroupMappings(subjectId: string): Observable<Record<string, { group_id: string, group_name: string }>> {
    return this.http.get<Record<string, { group_id: string, group_name: string }>>(`${API_URL}/subjects/${subjectId}/student-group-mappings`);
  }

  assignStudentToGroup(subjectId: string, userName: string, groupId: string | null): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${subjectId}/students/${userName}/assign-group`, { group_id: groupId });
  }

  sendMessage(recipient: string, content: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/messages`, { recipient_name: recipient, content });
  }

  getDialogs(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/messages/dialogs`);
  }

  getUserPresence(userName: string): Observable<{ username: string; is_online: boolean; last_seen?: number }> {
    return this.http.get<{ username: string; is_online: boolean; last_seen?: number }>(
      `${API_URL}/messages/presence`,
      { params: new HttpParams().set('user', userName) }
    );
  }

  getChatHistory(withUser: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/messages/history`, { params: new HttpParams().set('with_user', withUser) });
  }

  markChatRead(withUser: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/messages/mark-read`, {}, { params: new HttpParams().set('with_user', withUser) });
  }

  clearChatHistory(withUser: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/messages/history`, { params: new HttpParams().set('with_user', withUser) });
  }

  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/messages/${messageId}`);
  }

  uploadChatFile(file: File): Observable<{ url: string; file_name: string; content_type: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<{ url: string; file_name: string; content_type: string; size: number }>(`${API_URL}/messages/upload`, formData);
  }

  // Tests
  getTests(subjectId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    return this.http.get<any[]>(`${API_URL}/tests`, { params });
  }

  getTest(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/tests/${id}`);
  }

  createTest(test: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/tests`, test);
  }

  updateTest(id: string, test: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/tests/${id}`, test);
  }

  deleteTest(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/tests/${id}`);
  }

  getTestFiles(testId: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/tests/${testId}/files`);
  }

  uploadTestFile(testId: string, formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/tests/${testId}/files`, formData);
  }

  deleteTestFile(testId: string, fileId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/tests/${testId}/files/${fileId}`);
  }

  // Submissions
  getSubmissions(testId?: string, user?: string): Observable<any[]> {
    let params = new HttpParams();
    if (testId) {
      params = params.set('test_id', testId);
    }
    if (user) {
      params = params.set('user', user);
    }
    return this.http.get<any[]>(`${API_URL}/submissions`, { params });
  }

  createSubmission(submission: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/submissions`, submission);
  }

  createSubmissionVersion(id: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/submissions/${id}/new-version`, {});
  }

  updateSubmission(id: string, submission: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/submissions/${id}`, submission);
  }

  finishSubmission(id: string, useAi: boolean = false): Observable<any> {
    return this.http.post<any>(`${API_URL}/submissions/${id}/finish?use_ai=${useAi}`, {});
  }

  getSubmissionResults(id: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/submissions/${id}/results`);
  }

  getSubmissionFiles(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/submissions/${id}/files`);
  }

  uploadSubmissionFile(id: string, formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/submissions/${id}/files`, formData);
  }

  updateSubmissionStatus(id: string, status: string, teacher_feedback?: string, total_score?: number) {
    return this.http.patch(`${API_URL}/submissions/${id}/status`, { status, teacher_feedback, total_score });
  }

  deleteSubmissionFile(submissionId: string, fileId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/submissions/${submissionId}/files/${fileId}`);
  }

  deleteSubmission(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/submissions/${id}`);
  }

  // Materials
  getMaterials(subjectId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    return this.http.get<any[]>(`${API_URL}/materials`, { params });
  }

  uploadMaterial(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/materials`, formData);
  }

  createMaterialAnnotation(materialId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/materials/${materialId}/annotate`, {});
  }

  deleteMaterial(materialId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/materials/${materialId}`);
  }

  getMaterialStatus(materialId: string, format?: string): Observable<any> {
    let params = new HttpParams();
    if (format) {
      params = params.set('format', format);
    }
    return this.http.get<any>(`${API_URL}/materials/${materialId}/status`, { params });
  }

  downloadMaterialWithFormat(materialId: string, format: string): Observable<Blob> {
    return this.http.get(`${API_URL}/materials/${materialId}/download`, {
      params: new HttpParams().set('format', format),
      responseType: 'blob'
    });
  }

  // Videos
  getVideos(subjectId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    return this.http.get<any[]>(`${API_URL}/videos`, { params });
  }

  createVideo(video: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/videos`, video);
  }

  deleteVideo(videoId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/videos/${videoId}`);
  }

  // AI
  getAiStatus(): Observable<any> {
    return this.http.get<any>(`${API_URL}/ai/status`);
  }

  generateTest(request: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/ai/generate-test`, request);
  }

  chat(question: string, subjectId?: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/ai/chat`, { question, subject_id: subjectId });
  }

  agentChatStream(
    question: string,
    sessionId?: string,
    subjectId?: string,
    token?: string | null
  ): Observable<{ type: string; data: any }> {
    return new Observable(observer => {
      const abortController = new AbortController();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${API_URL}/ai/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question,
          session_id: sessionId || null,
          subject_id: subjectId || null
        }),
        signal: abortController.signal
      })
        .then(async response => {
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
          }
          if (!response.body) {
            throw new Error('Response body is null');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = 'message';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.substring(6).trim();
              } else if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.substring(5).trim();
                try {
                  const parsedData = JSON.parse(dataStr);
                  observer.next({ type: currentEvent, data: parsedData });
                } catch (e) {
                  observer.next({ type: currentEvent, data: dataStr });
                }
              }
            }
          }

          observer.complete();
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            observer.error(err);
          }
        });

      return () => {
        abortController.abort();
      };
    });
  }

  getTestFeedback(feedbackRequest: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/ai/test-feedback`, feedbackRequest);
  }

  // Peer Review
  getSubmissionsForReview(testId: string, reviewer: string): Observable<any[]> {
    let params = new HttpParams();
    params = params.set('test_id', testId);
    params = params.set('reviewer', reviewer);
    return this.http.get<any[]>(`${API_URL}/reviews/submissions-for-review`, { params });
  }

  getMyReviews(user: string, testId?: string): Observable<any[]> {
    let params = new HttpParams();
    params = params.set('user', user);
    if (testId) {
      params = params.set('test_id', testId);
    }
    return this.http.get<any[]>(`${API_URL}/reviews/my-reviews`, { params });
  }

  createReview(review: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/reviews`, review);
  }

  getReviews(submissionId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (submissionId) {
      params = params.set('submission_id', submissionId);
    }
    return this.http.get<any[]>(`${API_URL}/reviews`, { params });
  }

  getSubmissionReviews(submissionId: string): Observable<any[]> {
    return this.getReviews(submissionId);
  }

  deleteReview(id: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/reviews/${id}`);
  }

  // Gamification
  getLeaderboard(subjectId?: string, limit?: number): Observable<any[]> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    if (limit) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<any[]>(`${API_URL}/points`, { params });
  }

  exportLeaderboard(subjectId?: string): Observable<Blob> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    return this.http.get(`${API_URL}/points/export`, { params, responseType: 'blob' });
  }

  getUserPoints(username: string, subjectId?: string): Observable<any> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    return this.http.get<any>(`${API_URL}/points/${username}`, { params });
  }

  // News
  getNews(subjectId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    return this.http.get<any[]>(`${API_URL}/news`, { params });
  }

  createNews(news: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/news`, news);
  }

  updateNews(newsId: string, news: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/news/${newsId}`, news);
  }

  deleteNews(newsId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/news/${newsId}`);
  }

  // Groups
  getGroups(subjectId?: string, userName?: string): Observable<any[]> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    if (userName) {
      params = params.set('user_name', userName);
    }
    return this.http.get<any[]>(`${API_URL}/groups`, { params });
  }

  getGroup(groupId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/groups/${groupId}`);
  }

  createGroup(group: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/groups`, group);
  }

  updateGroup(groupId: string, group: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/groups/${groupId}`, group);
  }

  deleteGroup(groupId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/groups/${groupId}`);
  }

  getGroupMembers(groupId: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/groups/${groupId}/members`);
  }

  addGroupMember(groupId: string, member: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/groups/${groupId}/members`, member);
  }

  removeGroupMember(groupId: string, memberId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/groups/${groupId}/members/${memberId}`);
  }

  // Notifications
  getNotifications(userName?: string, isRead?: boolean): Observable<any[]> {
    let params = new HttpParams();
    if (userName) {
      params = params.set('user_name', userName);
    }
    if (isRead !== undefined) {
      params = params.set('is_read', isRead.toString());
    }
    return this.http.get<any[]>(`${API_URL}/notifications`, { params });
  }

  getNotificationCount(userName: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/notifications/count?user_name=${encodeURIComponent(userName)}`);
  }

  createNotification(notification: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/notifications`, notification);
  }

  markNotificationRead(notificationId: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/notifications/${notificationId}/mark-read`, {});
  }

  markAllNotificationsRead(userName: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/notifications/mark-all-read?user_name=${encodeURIComponent(userName)}`, {});
  }

  deleteNotification(notificationId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/notifications/${notificationId}`);
  }

  // Feedback
  getFeedbacks(userName?: string, subjectId?: string, groupId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (userName) {
      params = params.set('user_name', userName);
    }
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    if (groupId) {
      params = params.set('group_id', groupId);
    }
    return this.http.get<any[]>(`${API_URL}/feedbacks`, { params });
  }

  getFeedbackStats(subjectId?: string, groupId?: string): Observable<any> {
    let params = new HttpParams();
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    if (groupId) {
      params = params.set('group_id', groupId);
    }
    return this.http.get<any>(`${API_URL}/feedbacks/stats`, { params });
  }

  createFeedback(feedback: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/feedbacks`, feedback);
  }

  deleteFeedback(feedbackId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/feedbacks/${feedbackId}`);
  }

  // Analytics
  createActivity(activity: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/analytics/activities`, activity);
  }

  getActivities(userName?: string, actionType?: string): Observable<any[]> {
    let params = new HttpParams();
    if (userName) {
      params = params.set('user_name', userName);
    }
    if (actionType) {
      params = params.set('action_type', actionType);
    }
    return this.http.get<any[]>(`${API_URL}/analytics/activities`, { params });
  }

  getProgress(userName?: string, subjectId?: string, groupId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (userName) {
      params = params.set('user_name', userName);
    }
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    if (groupId) {
      params = params.set('group_id', groupId);
    }
    return this.http.get<any[]>(`${API_URL}/analytics/progress`, { params });
  }

  getAnalyticsReport(subjectId?: string, groupId?: string, userName?: string, days: number = 30): Observable<any> {
    let params = new HttpParams().set('days', days.toString());
    if (subjectId) {
      params = params.set('subject_id', subjectId);
    }
    if (groupId) {
      params = params.set('group_id', groupId);
    }
    if (userName) {
      params = params.set('user_name', userName);
    }
    return this.http.get<any>(`${API_URL}/analytics/report`, { params });
  }

  getActivityStats(userName: string, days: number = 30): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/analytics/activity-stats?user_name=${encodeURIComponent(userName)}&days=${days}`);
  }

  // Users (for group management)
  getUsers(search?: string): Observable<any[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<any[]>(`${API_URL}/users`, { params });
  }

  // Group Requests
  createGroupRequest(groupId: string, userName: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/groups/${groupId}/requests`, { user_name: userName });
  }

  getGroupRequests(groupId: string, status?: string): Observable<any[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<any[]>(`${API_URL}/groups/${groupId}/requests`, { params });
  }

  updateGroupRequest(groupId: string, requestId: string, status: string, reviewedBy: string): Observable<any> {
    return this.http.put<any>(`${API_URL}/groups/${groupId}/requests/${requestId}`, {
      status: status,
      reviewed_by: reviewedBy
    });
  }

  getMyGroupRequests(userName: string, status?: string): Observable<any[]> {
    let params = new HttpParams().set('user_name', userName);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<any[]>(`${API_URL}/groups/requests/my`, { params });
  }

  // Course Structure
  getCourseStructure(subjectId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/subjects/${subjectId}/structure`);
  }

  createModule(subjectId: string, module: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/subjects/${subjectId}/modules`, module);
  }

  updateModule(moduleId: string, module: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/modules/${moduleId}`, module);
  }

  deleteModule(moduleId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/modules/${moduleId}`);
  }

  createLesson(moduleId: string, lesson: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/modules/${moduleId}/lessons`, lesson);
  }

  updateLesson(lessonId: string, lesson: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/lessons/${lessonId}`, lesson);
  }

  deleteLesson(lessonId: string): Observable<any> {
    return this.http.delete<any>(`${API_URL}/lessons/${lessonId}`);
  }

  createContent(lessonId: string, content: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/lessons/${lessonId}/content`, content);
  }

  updateContent(contentId: string, content: any): Observable<any> {
    return this.http.put<any>(`${API_URL}/content/${contentId}`, content);
  }

  getContent(lessonId: string): Observable<any> {
    return this.http.get<any>(`${API_URL}/lessons/${lessonId}/content`);
  }

  // Streaming
  createStreamingRoom(roomData: any): Observable<any> {
    return this.http.post<any>(`${API_URL}/streaming/rooms/create`, roomData);
  }

  generateStreamingToken(request: { room_name: string, identity: string, is_teacher: boolean }): Observable<any> {
    return this.http.post<any>(`${API_URL}/streaming/tokens/generate`, request);
  }

  getActiveStreamingRooms(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/streaming/rooms/active`);
  }

  endStreamingRoom(roomName: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/streaming/rooms/${roomName}/end`, {});
  }

  // AI Course Generation
  generateCourse(topic: string, additionalInfo?: string): Observable<any> {
    return this.http.post<any>(`${API_URL}/ai/generate-course`, {
      topic,
      additional_info: additionalInfo
    });
  }

  extractMaterialText(file: File): Observable<{ filename: string; text: string; char_count: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ filename: string; text: string; char_count: number }>(`${API_URL}/materials/extract-text`, formData);
  }

  // Advanced AI Course Generation
  suggestCourseStructure(topic: string, targetAudience: string = 'Beginners', additionalInfo?: string, sourceMaterials?: any[]): Observable<any> {
    return this.http.post<any>(`${API_URL}/ai/suggest-structure`, {
      topic,
      target_audience: targetAudience,
      additional_info: additionalInfo,
      source_materials: sourceMaterials
    });
  }

  generateCourseAdvanced(blueprint: any, topic: string, userName?: string, additionalInfo?: string, sourceMaterials?: any[]): Observable<any> {
    return this.http.post<any>(`${API_URL}/ai/generate-course-advanced`, {
      topic,
      additional_info: additionalInfo,
      user_name: userName,
      blueprint,
      source_materials: sourceMaterials
    });
  }

  generateCourseStream(blueprint: any, topic: string, userName?: string, additionalInfo?: string, sourceMaterials?: any[]): Observable<any> {
    return new Observable(observer => {
      const abortController = new AbortController();
      const token = localStorage.getItem('token') || localStorage.getItem('mockToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${API_URL}/ai/generate-course-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic,
          additional_info: additionalInfo,
          user_name: userName,
          blueprint,
          source_materials: sourceMaterials
        }),
        signal: abortController.signal
      })
        .then(async response => {
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
          }
          if (!response.body) {
            throw new Error('Response body is null');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = 'message';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.substring(6).trim();
              } else if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.substring(5).trim();
                try {
                  const parsedData = JSON.parse(dataStr);
                  observer.next({ type: currentEvent, data: parsedData });
                } catch (e) {
                  observer.next({ type: currentEvent, data: dataStr });
                }
              }
            }
          }

          observer.complete();
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            observer.error(err);
          }
        });

      return () => {
        abortController.abort();
      };
    });
  }
}
