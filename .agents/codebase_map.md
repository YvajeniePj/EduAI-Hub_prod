# EduAI-Hub Codebase Structural Map

## Architecture Overview
- **Repository Type**: Monorepo (Angular 17+ Frontend + FastAPI Microservices Backend + PostgreSQL + Redis)
- **Frontend Stack**: Angular 17 (Standalone Components, RxJS, Angular Material) under `/frontend`
- **Backend Stack**: 13 FastAPI Microservices under `/services`
- **Database Layer**: PostgreSQL migrations under `/database`
- **Infrastructure**: Docker Compose (`docker-compose.yml`), LiveKit (`infrastructure/livekit.yaml`), Nginx (`frontend/nginx.conf`)

---

## Backend Microservices Map (`/services/`)

| Microservice | Role & Primary Functionality |
| :--- | :--- |
| **`ai-service`** | Gemini API integration, LLM auto-grading of open assignments, 24/7 AI tutor assistant chat. |
| **`api-gateway`** | Central reverse proxy, Keycloak OIDC SSO token validation, cascade deletion orchestration. |
| **`peer-review-service`** | Anonymous student assignment distribution, peer scoring, cross-evaluation rubric logic. |
| **`submission-service`** | Student test/assignment attempts, response recording, state persistence. |
| **`test-service`** | Test bank creation, question models, auto-checking logic for multi-choice tests. |
| **`feedback-service`** | Storage and retrieval of AI-generated feedback and teacher evaluations. |
| **`gamification-service`** | XP points, student badges, leaderboard computations. |
| **`subject-service`** | Course structures, subjects, topics, and academic module metadata. |
| **`material-service`** | PDF lecture slides, document storage, text materials, annotation metadata. |
| **`video-service`** | Video lecture processing, metadata, and playback endpoints. |
| **`streaming-service`** | Real-time stream integration, LiveKit WebRTC sessions for live lectures. |
| **`notification-service`** | Student notification dispatcher, deadline alerts, system events. |
| **`analytics-service`** | Student activity tracking, course completion metrics, engagement monitoring. |

---

## Frontend Architectural Map (`/frontend/src/app/`)

### Core & Entrypoints
- `app.routes.ts`: Main Angular 17 router definition.
- `app.component.ts`: Root application shell.
- `core/`: Global HTTP interceptors, Keycloak Auth guards, singleton services.

### Feature Modules (`/frontend/src/app/features/`)
1. **`peer-review`**: Peer review evaluation dashboard, anonymous peer submission review.
2. **`ai-test`**: Interactive AI test practice and instant AI grading interface.
3. **`feedback-results`**: Detailed feedback breakdown UI (AI analysis + teacher comments).
4. **`submissions`**: Student submission history, status indicators.
5. **`tests`**: Student test-taking interface and teacher quiz editor.
6. **`leaderboard`**: Gamification ranking tables and student achievements.
7. **`course-builder`**: Drag-and-drop course and module editor for instructors.
8. **`course-view`**: Student view of course modules, progress bar, lesson navigation.
9. **`chat`**: Peer-to-peer chat interface & teacher communication.
10. **`streaming`**: Live lecture streaming component via WebRTC/LiveKit.
11. **`videos`**: Custom video player component with timestamp markers.
12. **`materials`**: PDF and document viewer with inline notes.
13. **`subjects`**: Course catalog and subject selection.
14. **`analytics`**: Instructor dashboard with performance graphs and metrics.
15. **`activity-monitor`**: Student engagement activity timeline.
16. **`admin`**: System administration and Keycloak user role management.
17. **`auth`**: SSO login integration, auth callback handling.
18. **`groups`**: Academic group management and cohort distribution.
19. **`home`**: Dashboard landing page.
20. **`news`**: Course announcements and platform updates.
21. **`profile`**: User profile settings and statistics.
22. **`students`**: Instructor view of enrolled students.
23. **`submissions`**: Grading queue for teachers.

---

## Data & API Flow Tracing

1. **Auth & Gateway Flow**:
   Client → Angular Auth Guard → Keycloak SSO → API Gateway (`/services/api-gateway`) → Target Microservice

2. **Auto-Grading Flow**:
   Student UI (`features/ai-test` or `features/tests`) → `submission-service` → `ai-service` (Gemini API Structured Output) → `feedback-service` → UI update

3. **Peer Review Flow**:
   Student submission → `submission-service` → `peer-review-service` (Strips student IDs) → Anonymous assignment queue in `features/peer-review`

---

## Database Migration Index (`/database/`)
- `create_db.sql`: Database baseline setup.
- `init.sql`: Table definitions for core entities.
- `migrate_course_structure.sql`: Subject/Module hierarchy.
- `migrate_analytics.sql`: Student analytics & tracking schema.
- `migrate_feedbacks.sql`: AI and teacher feedback schema.
- `migrate_groups.sql` & `migrate_groups_enhanced.sql`: Student cohorts schema.
- `migrate_materials_annotations.sql`: Material annotations.
- `migrate_notifications.sql`: System notification logs.
