"""
API Gateway - Entry point for all API requests
Routes requests to appropriate microservices
"""
from fastapi import FastAPI, HTTPException, Request, Query, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import os
from typing import Optional
import logging
from jose import jwt, JWTError
from datetime import datetime, timedelta
import time
from urllib.parse import quote

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="EduAI Hub API Gateway",
    description="API Gateway for EduAI Hub microservices",
    version="1.0.0"
)

# CORS middleware
origins = [
    "https://eduaihub.aitalenthub.ru",
    "http://eduaihub.aitalenthub.ru",
    "http://localhost:4200",
    "http://localhost:8100",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs from environment
SUBJECT_SERVICE_URL = os.getenv("SUBJECT_SERVICE_URL", "http://subject-service:8001")
TEST_SERVICE_URL = os.getenv("TEST_SERVICE_URL", "http://test-service:8002")
SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8003")
MATERIAL_SERVICE_URL = os.getenv("MATERIAL_SERVICE_URL", "http://material-service:8004")
VIDEO_SERVICE_URL = os.getenv("VIDEO_SERVICE_URL", "http://video-service:8005")
PEER_REVIEW_SERVICE_URL = os.getenv("PEER_REVIEW_SERVICE_URL", "http://peer-review-service:8006")
GAMIFICATION_SERVICE_URL = os.getenv("GAMIFICATION_SERVICE_URL", "http://gamification-service:8007")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai-service:8008")
ANALYTICS_SERVICE_URL = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8009")
STREAMING_SERVICE_URL = os.getenv("STREAMING_SERVICE_URL", "http://streaming-service:8012")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8010")
FEEDBACK_SERVICE_URL = os.getenv("FEEDBACK_SERVICE_URL", "http://feedback-service:8011")

# HTTP client with timeout


# Keycloak SSO Configuration
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "https://keycloak.aitalenthub.ru")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "aith")
JWKS_URI = os.getenv("JWKS_URI", f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs")
ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"

security = HTTPBearer(auto_error=False)

# Caching JWKS
_jwks_cache = None
_jwks_last_fetched = 0

async def get_jwks():
    global _jwks_cache, _jwks_last_fetched
    now = time.time()
    # Update JWKS every hour
    if _jwks_cache is None or now - _jwks_last_fetched > 3600:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(JWKS_URI)
                resp.raise_for_status()
                _jwks_cache = resp.json()
                _jwks_last_fetched = now
                logger.info("Successfully fetched JWKS from Keycloak")
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            if _jwks_cache is None:
                raise
    return _jwks_cache

async def verify_jwt_token_keycloak(token: str) -> Optional[dict]:
    """Verify JWT token using Keycloak JWKS and return user data"""
    try:
        jwks = await get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
                
        if not rsa_key:
            logger.error("Unable to find appropriate key in JWKS for the token")
            return None
            
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={"verify_aud": False}
        )
        
        return payload
    except JWTError as e:
        logger.error(f"JWT Validation Error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected token validation error: {e}")
        return None

# In-memory cache for Keycloak -> Local user mapping
# Key: Keycloak sub (UUID), Value: Local user dict
_user_mapping_cache = {}

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """Get current user from JWT token and link with internal DB"""
    if not credentials:
        return None
    
    payload = await verify_jwt_token_keycloak(credentials.credentials)
    if not payload:
        return None
        
    external_id = payload.get("sub")
    
    # Check cache first
    if external_id in _user_mapping_cache:
        cached_user = _user_mapping_cache[external_id]
        # Refresh cache if older than 5 minutes (optional, but good for role updates)
        return cached_user
        
    # User not in cache, find or create in submission-service
    username = payload.get("preferred_username") or payload.get("email")
    email = payload.get("email")
    
    # Try finding by ID first (since we use Keycloak sub as ID now)
    user_data, status, _ = await proxy_request(SUBMISSION_SERVICE_URL, f"/users/{external_id}", "GET")
    
    if status == 404:
        # Not found by ID, try finding by name
        user_data, status, _ = await proxy_request(SUBMISSION_SERVICE_URL, f"/users/by-name/{username}", "GET")
        
    if status == 404:
        # Still not found, create it
        # Extract role from token
        roles = payload.get("realm_access", {}).get("roles", [])
        role = "student"
        if "admin" in roles or "Admin" in roles:
            role = "admin"
        elif "teacher" in roles or "Teacher" in roles:
            role = "teacher"
            
        create_body = {
            "id": external_id,
            "name": username,
            "role": role,
            "avatar_url": None
        }
        user_data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, "/users", "POST", body=create_body)
        if status not in [200, 201]:
            logger.error(f"Failed to auto-create user: {status}, {error}")
            # Fallback to token data if creation fails
            return {
                "user_id": external_id,
                "username": username,
                "role": "student"
            }
            
    # Success finding or creating
    # Prefer full name from token if DB name is an ISU-placeholder or missing
    token_full_name = payload.get("name")
    internal_name = user_data["name"]
    if token_full_name and (internal_name.startswith("isu_") or not internal_name):
        internal_name = token_full_name
        # Sync back to DB if name improved
        if internal_name != user_data["name"]:
            await proxy_request(SUBMISSION_SERVICE_URL, f"/users/{external_id}", "PUT", body={"name": internal_name})

    # Normalize 'instructor' to 'teacher' for frontend compatibility
    role = user_data["role"]
    if role == "instructor":
        role = "teacher"

    internal_user = {
        "user_id": str(user_data["id"]),
        "username": internal_name,
        "role": role,
        "avatar_url": user_data.get("avatar_url"),
        "is_hidden_admin": user_data.get("is_hidden_admin", False)
    }
    
    # Overwrite role and is_hidden_admin if preferred_username matches SuperAdmin (508982)
    preferred_username = payload.get("preferred_username")
    isu_number = payload.get("isu_number")
    
    # 1. Force Admin (508982)
    if preferred_username in ["508982", "isu_508982"] or isu_number == "508982":
        # Only override/set to True if not explicitly saved as False in the DB
        if user_data.get("is_hidden_admin") is not False:
            internal_user["is_hidden_admin"] = True
        else:
            internal_user["is_hidden_admin"] = False
        
    # 2. Force Teacher (307553 - Юлия Разливина)
    if preferred_username in ["307553", "isu_307553"] or isu_number == "307553":
        internal_user["role"] = "teacher"
        # Sync back to DB if currently student
        if user_data.get("role") == "student":
            asyncio.create_task(proxy_request(SUBMISSION_SERVICE_URL, f"/users/{external_id}", "PUT", body={"role": "teacher"}))
    
    # Cache it
    _user_mapping_cache[external_id] = internal_user
    return internal_user


@app.get("/auth/me")
async def get_current_user_info(current_user: Optional[dict] = Depends(get_current_user)):
    """Get current user info from Keycloak token (linked to internal DB)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user



async def get_current_teacher(current_user: dict = Depends(get_current_user)):
    """Dependency to check if user is a teacher or admin"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    role = current_user.get("role")
    if role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized. Teacher or admin role required.")
    return current_user


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "api-gateway"}


# Proxy request function (Moved below JWT auth)
async def proxy_request(
    service_url: str,
    path: str,
    method: str = "GET",
    body: Optional[dict] = None,
    params: Optional[dict] = None,
    headers: Optional[dict] = None
):
    """Proxy request to a microservice"""
    url = f"{service_url}{path}"
    
    if headers:
        headers = {k: v for k, v in headers.items() if v is not None}
    else:
        headers = {}
        
    # Inject user info if available from request context (FastAPI doesn't do this automatically, 
    # so we might need to pass it explicitly or use contextvars. For now, we continue passing it explicitly where needed,
    # but let's make proxy_request a bit smarter if we can).
        
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method == "POST":
                response = await client.post(url, json=body, params=params, headers=headers)
            elif method == "PUT":
                response = await client.put(url, json=body, params=params, headers=headers)
            elif method == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            elif method == "PATCH":
                response = await client.patch(url, json=body, params=params, headers=headers)
            else:
                raise HTTPException(status_code=405, detail="Method not allowed")
            
            if response.status_code >= 400:
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                return None, response.status_code, error_detail
            
            try:
                return response.json(), response.status_code, None
            except:
                return response.text, response.status_code, None
    except httpx.RequestError as e:
        logger.error(f"Request error to {url}: {e}")
        # Log resolution info for debugging
        try:
            import socket
            hostname = service_url.split("//")[-1].split(":")[0]
            ip = socket.gethostbyname(hostname)
            logger.info(f"Resolved {hostname} to {ip}")
        except:
            pass
        raise HTTPException(status_code=503, detail=f"Service unavailable: {service_url}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Subject Service Routes
@app.get("/subjects")
async def get_subjects(current_user: Optional[dict] = Depends(get_current_user)):
    params = {}
    if current_user:
        params["user_name"] = current_user.get("username")
        params["role"] = current_user.get("role")
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, "/subjects", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch subjects")
    return data


@app.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch subject")
    return data


@app.get("/subjects/{subject_id}/teachers")
async def get_subject_teachers(subject_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}/teachers", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch teachers")
    return data


@app.post("/subjects/{subject_id}/teachers")
async def add_subject_teacher(subject_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}/teachers", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to add teacher")
    return data


@app.delete("/subjects/{subject_id}/teachers/{user_name}")
async def remove_subject_teacher(subject_id: str, user_name: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}/teachers/{user_name}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to remove teacher")
    return data


@app.post("/subjects")
async def create_subject(request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    # URL encode the username to handle Cyrillic characters safely in headers
    encoded_name = quote(current_user["username"])
    headers = {"X-User-Name": encoded_name}
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, "/subjects", "POST", body, headers=headers)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create subject")
    return data


@app.post("/subjects/{subject_id}/clone")
async def clone_subject(subject_id: str, current_user: dict = Depends(get_current_teacher)):
    """Clone a subject"""
    encoded_name = quote(current_user["username"])
    headers = {"X-User-Name": encoded_name}
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}/clone", "POST", headers=headers)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to clone subject")
    return data


@app.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete subject")
    return data


@app.put("/subjects/{subject_id}")
async def update_subject(subject_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update subject")
    return data


@app.post("/subjects/{subject_id}/cover")
async def upload_subject_cover(subject_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    """Upload a cover image for a subject"""
    form = await request.form()
    
    files = {}
    for key, value in form.items():
        if hasattr(value, 'filename') and hasattr(value, 'read'):
            file_content = await value.read()
            files[key] = (value.filename, file_content, value.content_type or "image/jpeg")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/cover",
                files=files
            )
            
            if response.status_code >= 400:
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error to subject service: {e}")
        raise HTTPException(status_code=503, detail="Subject service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/subjects/{subject_id}/cover")
async def get_subject_cover(subject_id: str):
    """Get the cover image for a subject"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/cover")
            
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail="Cover not found")
            
            from fastapi.responses import Response
            return Response(
                content=response.content,
                media_type=response.headers.get("content-type", "image/jpeg")
            )
    except httpx.RequestError as e:
        logger.error(f"Request error to subject service: {e}")
        raise HTTPException(status_code=503, detail="Subject service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Course Structure Routes
@app.get("/subjects/{subject_id}/structure")
async def get_course_structure(subject_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}/structure", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch course structure")
    return data


@app.post("/subjects/{subject_id}/modules")
async def create_module(subject_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/subjects/{subject_id}/modules", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create module")
    return data


@app.put("/modules/{module_id}")
async def update_module(module_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/modules/{module_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update module")
    return data


@app.delete("/modules/{module_id}")
async def delete_module(module_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/modules/{module_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete module")
    return data


@app.post("/modules/{module_id}/lessons")
async def create_lesson(module_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/modules/{module_id}/lessons", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create lesson")
    return data


@app.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/lessons/{lesson_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update lesson")
    return data


@app.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/lessons/{lesson_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete lesson")
    return data


@app.post("/lessons/{lesson_id}/content")
async def create_content(lesson_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/lessons/{lesson_id}/content", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create content")
    return data


@app.put("/content/{content_id}")
async def update_content(content_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/content/{content_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update content")
    return data


@app.get("/lessons/{lesson_id}/content")
async def get_content(lesson_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/lessons/{lesson_id}/content", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch content")
    return data


# News Routes
@app.get("/news")
async def get_news(subject_id: Optional[str] = None):
    params = {"subject_id": subject_id} if subject_id else None
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, "/news", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch news")
    return data


@app.get("/news/{news_id}")
async def get_news_item(news_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/news/{news_id}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch news")
    return data


@app.post("/news")
async def create_news(request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, "/news", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create news")
    return data


@app.put("/news/{news_id}")
async def update_news(news_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/news/{news_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update news")
    return data


@app.delete("/news/{news_id}")
async def delete_news(news_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/news/{news_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete news")
    return data


# Test Service Routes
@app.get("/tests")
async def get_tests(subject_id: Optional[str] = None):
    params = {"subject_id": subject_id} if subject_id else None
    data, status, error = await proxy_request(TEST_SERVICE_URL, "/tests", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch tests")
    return data


@app.get("/tests/{test_id}")
async def get_test(test_id: str):
    data, status, error = await proxy_request(TEST_SERVICE_URL, f"/tests/{test_id}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch test")
    return data


@app.post("/tests")
async def create_test(request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    # URL encode the username to handle Cyrillic characters safely in headers
    encoded_name = quote(current_user["username"])
    headers = {"X-User-Name": encoded_name}
    data, status, error = await proxy_request(TEST_SERVICE_URL, "/tests", "POST", body, headers=headers)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create test")
    return data


@app.put("/tests/{test_id}")
async def update_test(test_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(TEST_SERVICE_URL, f"/tests/{test_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update test")
    return data


@app.delete("/tests/{test_id}")
async def delete_test(test_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(TEST_SERVICE_URL, f"/tests/{test_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete test")
    return data


@app.get("/tests/{test_id}/files")
async def get_test_files(test_id: str):
    data, status, error = await proxy_request(TEST_SERVICE_URL, f"/tests/{test_id}/files", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch test files")
    return data


@app.post("/tests/{test_id}/files")
async def upload_test_file(test_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    """Upload a file to a test - proxy multipart form data"""
    form = await request.form()
    files = {}
    for key, value in form.items():
        if hasattr(value, 'filename') and hasattr(value, 'read'):
            file_content = await value.read()
            files[key] = (value.filename, file_content, value.content_type or "application/octet-stream")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client_async:
            response = await client_async.post(
                f"{TEST_SERVICE_URL}/tests/{test_id}/files",
                files=files
            )
            if response.status_code >= 400:
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error to test service: {e}")
        raise HTTPException(status_code=503, detail="Test service unavailable")


@app.get("/tests/{test_id}/files/{file_id}/download")
async def download_test_file(test_id: str, file_id: str):
    """Proxy file download from test service"""
    try:
        client = httpx.AsyncClient(timeout=60.0)
        req = client.build_request("GET", f"{TEST_SERVICE_URL}/tests/{test_id}/files/{file_id}/download")
        response = await client.send(req, stream=True)
        
        if response.status_code >= 400:
            await response.aread()
            try:
                error_detail = response.json()
            except:
                error_detail = response.text
            await client.aclose()
            raise HTTPException(status_code=response.status_code, detail=error_detail)
            
        # Filter headers we want to forward
        exclude_headers = ["content-encoding", "content-length", "transfer-encoding", "connection"]
        forward_headers = {
            k: v for k, v in response.headers.items() 
            if k.lower() not in exclude_headers
        }
        
        # Ensure Content-Disposition is set if missing
        if "content-disposition" not in [k.lower() for k in forward_headers]:
            forward_headers["Content-Disposition"] = f"attachment; filename=test_file_{file_id}"

        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            media_type=response.headers.get("content-type"),
            headers=forward_headers,
            background=getattr(client, "aclose")
        )
    except httpx.RequestError as e:
        logger.error(f"Request error to test service: {e}")
        raise HTTPException(status_code=503, detail="Test service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/tests/{test_id}/files/{file_id}")
async def delete_test_file(test_id: str, file_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(TEST_SERVICE_URL, f"/tests/{test_id}/files/{file_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete test file")
    return data


# Submission Service Routes
@app.get("/submissions")
async def get_submissions(test_id: Optional[str] = None, user: Optional[str] = None):
    params = {}
    if test_id:
        params["test_id"] = test_id
    if user:
        params["user"] = user
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, "/submissions", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch submissions")
    return data


@app.post("/submissions")
async def create_submission(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, "/submissions", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create submission")
    return data


@app.put("/submissions/{submission_id}")
async def update_submission(submission_id: str, request: Request):
    body = await request.json()
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update submission")
    return data


@app.post("/submissions/{submission_id}/finish")
async def finish_submission(submission_id: str, use_ai: bool = False):
    params = {"use_ai": use_ai} if use_ai else None
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}/finish", "POST", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to finish submission")
    return data


@app.get("/submissions/{submission_id}/results")
async def get_submission_results(submission_id: str):
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}/results", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch results")
    return data


@app.patch("/submissions/{submission_id}/status")
async def update_submission_status(submission_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}/status", "PATCH", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update submission status")
    return data


@app.get("/submissions/{submission_id}/files")
async def get_submission_files(submission_id: str):
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}/files", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch submission files")
    return data


@app.post("/submissions/{submission_id}/files")
async def upload_submission_file(submission_id: str, request: Request):
    """Upload a file to a submission - proxy multipart form data"""
    form = await request.form()
    files = {}
    for key, value in form.items():
        if hasattr(value, 'filename') and hasattr(value, 'read'):
            file_content = await value.read()
            files[key] = (value.filename, file_content, value.content_type or "application/octet-stream")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client_async:
            response = await client_async.post(
                f"{SUBMISSION_SERVICE_URL}/submissions/{submission_id}/files",
                files=files
            )
            if response.status_code >= 400:
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error to submission service: {e}")
        raise HTTPException(status_code=503, detail="Submission service unavailable")


@app.delete("/submissions/{submission_id}/files/{file_id}")
async def delete_submission_file(submission_id: str, file_id: str):
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}/files/{file_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete submission file")
    return data


@app.delete("/submissions/{submission_id}")
async def delete_submission(submission_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/submissions/{submission_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete submission")
    return data

# Users (handled in submission-service)
@app.get("/users")
async def get_users():
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, "/users", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch users")
    return data


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/users/{user_id}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch user")
    return data


@app.get("/users/by-name/{name}")
async def get_user_by_name(name: str):
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/users/by-name/{name}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch user")
    return data


@app.post("/users")
async def create_user(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, "/users", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create user")
    return data


@app.put("/users/{user_id}")
async def update_user(user_id: str, request: Request, current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/users/{user_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update user")
        
    # Invalidate cache
    if user_id in _user_mapping_cache:
        del _user_mapping_cache[user_id]
        
    return data


@app.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: Optional[dict] = Depends(get_current_user)):
    """Delete a user by ID - currently restricted to teachers or admins"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # We should ideally check if current_user is a teacher or the user themselves
    # For now, allowing teachers as admins
    role = current_user.get("role")
    if role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    data, status, error = await proxy_request(SUBMISSION_SERVICE_URL, f"/users/{user_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete user")
    return data


@app.post("/users/{user_id}/avatar")
async def upload_avatar(user_id: str, request: Request, current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    form = await request.form()
    files = {}
    for key, value in form.items():
        if hasattr(value, 'filename') and hasattr(value, 'read'):
            file_content = await value.read()
            files[key] = (value.filename, file_content, value.content_type or "image/jpeg")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client_async:
            response = await client_async.post(
                f"{SUBMISSION_SERVICE_URL}/users/{user_id}/avatar",
                files=files
            )
            
            if response.status_code >= 400:
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error to submission service: {e}")
        raise HTTPException(status_code=503, detail="Submission service unavailable")


@app.get("/static/avatars/{filename}")
async def get_avatar(filename: str):
    """Proxy avatar files from submission-service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{SUBMISSION_SERVICE_URL}/static/avatars/{filename}")
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail="Avatar not found")
            return Response(
                content=response.content,
                media_type=response.headers.get("content-type", "image/jpeg")
            )
    except httpx.RequestError as e:
        logger.error(f"Request error to submission service for avatar: {e}")
        raise HTTPException(status_code=503, detail="Submission service unavailable")


@app.get("/submissions/static/avatars/{filename}")
async def get_avatar_submissions(filename: str):
    """Proxy cached avatars from submission-service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{SUBMISSION_SERVICE_URL}/static/avatars/{filename}")
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail="Avatar not found")
            return Response(
                content=response.content,
                media_type=response.headers.get("content-type", "image/jpeg")
            )
    except httpx.RequestError as e:
        logger.error(f"Request error to submission service for avatar: {e}")
        raise HTTPException(status_code=503, detail="Submission service unavailable")


@app.get("/static/news/{filename}")
async def get_news_image(filename: str):
    """Proxy news image files from submission-service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{SUBMISSION_SERVICE_URL}/static/news/{filename}")
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail="Image not found")
            return Response(
                content=response.content,
                media_type=response.headers.get("content-type", "image/jpeg")
            )
    except httpx.RequestError as e:
        logger.error(f"Request error to submission service for news image: {e}")
        raise HTTPException(status_code=503, detail="Submission service unavailable")


@app.post("/news/upload-image")
async def upload_news_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_teacher)
):
    """Proxy news image upload to submission-service (Teachers/Admins only)"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            file_content = await file.read()
            files = {'file': (file.filename, file_content, file.content_type)}
            response = await client.post(
                f"{SUBMISSION_SERVICE_URL}/news/upload-image",
                files=files
            )
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error to submission service for news upload: {e}")
        raise HTTPException(status_code=503, detail="Submission service unavailable")


# Material Service Routes
@app.get("/materials")
async def get_materials(subject_id: Optional[str] = None):
    params = {"subject_id": subject_id} if subject_id else None
    data, status, error = await proxy_request(MATERIAL_SERVICE_URL, "/materials", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch materials")
    return data


@app.post("/materials")
async def create_material(request: Request, current_user: dict = Depends(get_current_teacher)):
    """Upload a material file - proxy multipart form data"""
    form = await request.form()
    
    # Forward multipart form data to material service
    files = {}
    data = {}
    for key, value in form.items():
        # Check if it's a file (UploadFile)
        if hasattr(value, 'filename') and hasattr(value, 'read'):
            # It's a file
            file_content = await value.read()
            files[key] = (value.filename, file_content, value.content_type or "application/octet-stream")
        else:
            # It's regular form data
            data[key] = value
    
    # URL encode the username to handle Cyrillic characters safely in headers
    encoded_name = quote(current_user["username"])
    headers = {"X-User-Name": encoded_name}
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:  # 5 minutes for large files
            response = await client.post(
                f"{MATERIAL_SERVICE_URL}/materials",
                files=files if files else None,
                data=data if data else None,
                headers=headers
            )
            
            if response.status_code >= 400:
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error to material service: {e}")
        raise HTTPException(status_code=503, detail="Material service unavailable")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/materials/{material_id}")
async def get_material(material_id: str):
    data, status, error = await proxy_request(MATERIAL_SERVICE_URL, f"/materials/{material_id}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch material")
    return data


@app.get("/materials/{material_id}/text")
async def get_material_text(material_id: str):
    data, status, error = await proxy_request(MATERIAL_SERVICE_URL, f"/materials/{material_id}/text", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch material text")
    return data


@app.post("/materials/{material_id}/annotate")
async def create_material_annotation(material_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(MATERIAL_SERVICE_URL, f"/materials/{material_id}/annotate", "POST")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to create annotation")
    return data


@app.delete("/materials/{material_id}")
async def delete_material(material_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(MATERIAL_SERVICE_URL, f"/materials/{material_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete material")
    return data


@app.get("/materials/{material_id}/status")
async def get_material_status(material_id: str, format: Optional[str] = Query(None)):
    data, status, error = await proxy_request(MATERIAL_SERVICE_URL, f"/materials/{material_id}/status", "GET", params={"format": format} if format else None)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch material status")
    return data


@app.get("/materials/{material_id}/download")
async def download_material(material_id: str, request: Request):
    """Download a material file - proxy the file response"""
    params = dict(request.query_params)
    try:
        client = httpx.AsyncClient(timeout=60.0)
        # Use stream=True to avoid loading large files into memory
        req = client.build_request(
            "GET", 
            f"{MATERIAL_SERVICE_URL}/materials/{material_id}/download",
            params=params
        )
        response = await client.send(req, stream=True)
        
        if response.status_code >= 400:
            await response.aread()  # Consume body
            try:
                error_detail = response.json()
            except:
                error_detail = response.text
            await client.aclose()
            raise HTTPException(status_code=response.status_code, detail=error_detail)
        
        # Filter headers we want to forward
        exclude_headers = ["content-encoding", "content-length", "transfer-encoding", "connection"]
        forward_headers = {
            k: v for k, v in response.headers.items() 
            if k.lower() not in exclude_headers
        }
        
        # Case-insensitive check for Content-Disposition
        has_disposition = any(k.lower() == "content-disposition" for k in forward_headers)
        if not has_disposition:
            forward_headers["Content-Disposition"] = f"attachment; filename=material_{material_id}"

        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            media_type=response.headers.get("content-type"),
            headers=forward_headers,
            background=getattr(client, "aclose")
        )
    except httpx.RequestError as e:
        logger.error(f"Request error to material service: {e}")
        raise HTTPException(status_code=503, detail="Material service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Video Service Routes
@app.get("/videos")
async def get_videos(subject_id: Optional[str] = None):
    params = {"subject_id": subject_id} if subject_id else None
    data, status, error = await proxy_request(VIDEO_SERVICE_URL, "/videos", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch videos")
    return data


@app.post("/videos")
async def create_video(request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    # URL encode the username to handle Cyrillic characters safely in headers
    encoded_name = quote(current_user["username"])
    headers = {"X-User-Name": encoded_name}
    data, status, error = await proxy_request(VIDEO_SERVICE_URL, "/videos", "POST", body, headers=headers)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create video")
    return data


@app.delete("/videos/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(VIDEO_SERVICE_URL, f"/videos/{video_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete video")
    return data


# AI Service Routes
@app.get("/ai/status")
async def get_ai_status():
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/status", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to get AI status")
    return data


@app.post("/ai/annotate")
async def annotate_material(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/annotate", "POST", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to create annotation")
    return data


@app.post("/ai/grade")
async def grade_answer(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/grade", "POST", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to grade answer")
    return data


@app.post("/ai/chat")
async def chat_assistant(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/chat", "POST", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to process chat")
    return data


@app.post("/ai/generate-test")
async def generate_test(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/generate-test", "POST", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to generate test")
    return data


@app.post("/ai/generate-course")
async def generate_course(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/generate-course", "POST", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to generate course")
    return data


@app.post("/ai/test-feedback")
async def get_test_feedback(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(AI_SERVICE_URL, "/ai/test-feedback", "POST", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to get test feedback")
    return data


# Peer Review Service Routes
@app.get("/reviews")
async def get_reviews(submission_id: Optional[str] = None):
    params = {"submission_id": submission_id} if submission_id else None
    data, status, error = await proxy_request(PEER_REVIEW_SERVICE_URL, "/reviews", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch reviews")
    return data


@app.get("/reviews/submissions-for-review")
async def get_submissions_for_review(test_id: str, reviewer: str):
    params = {"test_id": test_id, "reviewer": reviewer}
    data, status, error = await proxy_request(PEER_REVIEW_SERVICE_URL, "/reviews/submissions-for-review", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch submissions for review")
    return data


@app.get("/reviews/my-reviews")
async def get_my_reviews(user: str, test_id: Optional[str] = None):
    params = {"user": user}
    if test_id:
        params["test_id"] = test_id
    data, status, error = await proxy_request(PEER_REVIEW_SERVICE_URL, "/reviews/my-reviews", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch my reviews")
    return data


@app.post("/reviews")
async def create_review(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(PEER_REVIEW_SERVICE_URL, "/reviews", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create review")
    return data


@app.delete("/reviews/{review_id}")
async def delete_review(review_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(PEER_REVIEW_SERVICE_URL, f"/reviews/{review_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete review")
    return data


# Gamification Service Routes
@app.get("/points")
async def get_leaderboard(subject_id: Optional[str] = None, limit: Optional[int] = 100):
    params = {"limit": limit}
    if subject_id:
        params["subject_id"] = subject_id
    data, status, error = await proxy_request(GAMIFICATION_SERVICE_URL, "/points", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch leaderboard")
    return data


@app.get("/points/export")
async def export_leaderboard(subject_id: Optional[str] = None):
    params = {"subject_id": subject_id} if subject_id else None
    data, status, error = await proxy_request(GAMIFICATION_SERVICE_URL, "/points/export", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to export leaderboard")
    return data


@app.get("/points/{username}")
async def get_user_points(username: str, subject_id: Optional[str] = None):
    params = {"subject_id": subject_id} if subject_id else None
    data, status, error = await proxy_request(GAMIFICATION_SERVICE_URL, f"/points/{username}", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch user points")
    return data


@app.post("/points")
async def award_points(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(GAMIFICATION_SERVICE_URL, "/points", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to award points")
    return data


# Analytics Service Routes
ANALYTICS_SERVICE_URL = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8009")

@app.post("/analytics/activities")
async def create_activity(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/activities", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create activity")
    return data


@app.get("/analytics/report")
async def get_analytics_report(
    subject_id: Optional[str] = None,
    group_id: Optional[str] = None,
    user_name: Optional[str] = None,
    days: int = 30
):
    params = {"days": days}
    if subject_id:
        params["subject_id"] = subject_id
    if group_id:
        params["group_id"] = group_id
    if user_name:
        params["user_name"] = user_name
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/report", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch analytics report")
    return data


@app.get("/analytics/progress")
async def get_analytics_progress(
    user_name: Optional[str] = None,
    subject_id: Optional[str] = None,
    group_id: Optional[str] = None
):
    params = {}
    if user_name:
        params["user_name"] = user_name
    if subject_id:
        params["subject_id"] = subject_id
    if group_id:
        params["group_id"] = group_id
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/progress", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch progress")
    return data


# --- Streaming Service ---

@app.post("/streaming/rooms/create")
async def create_streaming_room(room_data: dict):
    data, status, error = await proxy_request(STREAMING_SERVICE_URL, "/streaming/rooms/create", "POST", room_data)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create streaming room")
    return data

@app.post("/streaming/tokens/generate")
async def generate_streaming_token(request: dict):
    data, status, error = await proxy_request(STREAMING_SERVICE_URL, "/streaming/tokens/generate", "POST", request)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to generate streaming token")
    return data

@app.get("/streaming/rooms/active")
async def get_active_streaming_rooms():
    data, status, error = await proxy_request(STREAMING_SERVICE_URL, "/streaming/rooms/active")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch active streaming rooms")
    return data

@app.post("/streaming/rooms/{room_name}/end")
async def end_streaming_room(room_name: str):
    data, status, error = await proxy_request(STREAMING_SERVICE_URL, f"/streaming/rooms/{room_name}/end", "POST")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to end streaming room")
    return data


# Groups Routes (Subject Service)
@app.get("/groups")
async def get_groups(subject_id: Optional[str] = None, user_name: Optional[str] = None):
    params = {}
    if subject_id:
        params["subject_id"] = subject_id
    if user_name:
        params["user_name"] = user_name
        
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, "/groups", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch groups")
    return data


@app.post("/groups")
async def create_group(request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, "/groups", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create group")
    return data


@app.get("/groups/{group_id}")
async def get_group(group_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch group")
    return data


@app.put("/groups/{group_id}")
async def update_group(group_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update group")
    return data


@app.delete("/groups/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete group")
    return data


@app.get("/groups/{group_id}/members")
async def get_group_members(group_id: str):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}/members", "GET")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch group members")
    return data


@app.post("/groups/{group_id}/members")
async def add_group_member(group_id: str, request: Request, current_user: dict = Depends(get_current_teacher)):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}/members", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to add group member")
    return data


@app.delete("/groups/{group_id}/members/{member_id}")
async def remove_group_member(group_id: str, member_id: str, current_user: dict = Depends(get_current_teacher)):
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}/members/{member_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to remove group member")
    return data


# Group Requests Routes
@app.post("/groups/{group_id}/requests")
async def create_group_request(group_id: str, request: Request):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}/requests", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create group request")
    return data


@app.get("/groups/{group_id}/requests")
async def get_group_requests(group_id: str, status: Optional[str] = None):
    params = {}
    if status:
        params["status"] = status
    data, status_code, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}/requests", "GET", params=params)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=error or "Failed to fetch group requests")
    return data


@app.put("/groups/{group_id}/requests/{request_id}")
async def update_group_request(group_id: str, request_id: str, request: Request):
    body = await request.json()
    data, status, error = await proxy_request(SUBJECT_SERVICE_URL, f"/groups/{group_id}/requests/{request_id}", "PUT", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to update group request")
    return data


@app.get("/groups/requests/my")
async def get_my_group_requests(user_name: str, status: Optional[str] = None):
    params = {"user_name": user_name}
    if status:
        params["status"] = status
    data, status_code, error = await proxy_request(SUBJECT_SERVICE_URL, "/groups/requests/my", "GET", params=params)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=error or "Failed to fetch my group requests")
    return data


# Notification Service Routes
@app.get("/notifications")
async def get_notifications(user_name: Optional[str] = None, is_read: Optional[bool] = None):
    params = {}
    if user_name:
        params["user_name"] = user_name
    if is_read is not None:
        params["is_read"] = is_read
    data, status, error = await proxy_request(NOTIFICATION_SERVICE_URL, "/notifications", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch notifications")
    return data


@app.get("/notifications/count")
async def get_notification_count(user_name: str):
    params = {"user_name": user_name}
    data, status, error = await proxy_request(NOTIFICATION_SERVICE_URL, "/notifications/count", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to get notification count")
    return data


@app.post("/notifications")
async def create_notification(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(NOTIFICATION_SERVICE_URL, "/notifications", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create notification")
    return data


@app.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(notification_id: str):
    data, status, error = await proxy_request(NOTIFICATION_SERVICE_URL, f"/notifications/{notification_id}/mark-read", "POST")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to mark notification as read")
    return data


@app.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user_name: str):
    params = {"user_name": user_name}
    data, status, error = await proxy_request(NOTIFICATION_SERVICE_URL, "/notifications/mark-all-read", "POST", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to mark all notifications as read")
    return data


@app.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str):
    data, status, error = await proxy_request(NOTIFICATION_SERVICE_URL, f"/notifications/{notification_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete notification")
    return data


# Feedback Service Routes
@app.get("/feedbacks")
async def get_feedbacks(user_name: Optional[str] = None, subject_id: Optional[str] = None, group_id: Optional[str] = None):
    params = {}
    if user_name:
        params["user_name"] = user_name
    if subject_id:
        params["subject_id"] = subject_id
    if group_id:
        params["group_id"] = group_id
    data, status, error = await proxy_request(FEEDBACK_SERVICE_URL, "/feedbacks", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch feedbacks")
    return data


@app.get("/feedbacks/stats")
async def get_feedback_stats(subject_id: Optional[str] = None, group_id: Optional[str] = None):
    params = {}
    if subject_id:
        params["subject_id"] = subject_id
    if group_id:
        params["group_id"] = group_id
    data, status, error = await proxy_request(FEEDBACK_SERVICE_URL, "/feedbacks/stats", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch feedback stats")
    return data


@app.post("/feedbacks")
async def create_feedback(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(FEEDBACK_SERVICE_URL, "/feedbacks", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create feedback")
    return data


@app.delete("/feedbacks/{feedback_id}")
async def delete_feedback(feedback_id: str):
    data, status, error = await proxy_request(FEEDBACK_SERVICE_URL, f"/feedbacks/{feedback_id}", "DELETE")
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to delete feedback")
    return data


# Analytics Service Routes
@app.post("/analytics/activities")
async def create_activity(request: Request):
    body = await request.json()
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/activities", "POST", body)
    if status not in [200, 201]:
        raise HTTPException(status_code=status, detail=error or "Failed to create activity")
    return data


@app.get("/analytics/activities")
async def get_activities(user_name: Optional[str] = None, action_type: Optional[str] = None):
    params = {}
    if user_name:
        params["user_name"] = user_name
    if action_type:
        params["action_type"] = action_type
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/activities", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch activities")
    return data


@app.get("/analytics/progress")
async def get_progress(user_name: Optional[str] = None, subject_id: Optional[str] = None, group_id: Optional[str] = None):
    params = {}
    if user_name:
        params["user_name"] = user_name
    if subject_id:
        params["subject_id"] = subject_id
    if group_id:
        params["group_id"] = group_id
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/progress", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch progress")
    return data


@app.get("/analytics/report")
async def get_analytics_report(
    subject_id: Optional[str] = None, 
    group_id: Optional[str] = None, 
    user_name: Optional[str] = None, 
    days: int = 30,
    current_user: dict = Depends(get_current_teacher)
):
    params = {"days": days}
    if subject_id:
        params["subject_id"] = subject_id
    if group_id:
        params["group_id"] = group_id
    if user_name:
        params["user_name"] = user_name
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/report", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch analytics report")
    return data


@app.get("/analytics/activity-stats")
async def get_activity_stats(user_name: str, days: int = 30):
    params = {"user_name": user_name, "days": days}
    data, status, error = await proxy_request(ANALYTICS_SERVICE_URL, "/analytics/activity-stats", "GET", params=params)
    if status != 200:
        raise HTTPException(status_code=status, detail=error or "Failed to fetch activity stats")
    return data


@app.on_event("shutdown")
async def shutdown():
    logger.info("Gateway shutting down")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

