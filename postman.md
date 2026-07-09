# Postman Collection Guide for Docgit APIs

This guide matches the current backend controller routes.

## 1) Base setup in Postman

Create a Postman Environment with these variables:

- `baseUrl` = `http://localhost:5000` *(change to your API URL/port)*
- `token` = *(leave empty initially)*
- `filePath` = `notes/readme.txt`
- `folderPath` = `notes/archive`
- `historyVersion` = `1`

---

## 2) Authenticate first

### 2.1 Register user
**POST** `{{baseUrl}}/api/auth/register`

Headers:
- `Content-Type: application/json`

Body (raw JSON):
```json
{
  "userName": "postman_user",
  "password": "P@ssword123",
  "email": "postman_user@example.com",
  "name": "Postman User"
}
```

Expected:
- `200 OK` on success
- `400 Bad Request` if username/email already exists or data is invalid

### 2.2 Login
**POST** `{{baseUrl}}/api/auth/login`

Headers:
- `Content-Type: application/json`

Body (raw JSON):
```json
{
  "userName": "postman_user",
  "password": "P@ssword123"
}
```

Expected response:
```json
{
  "token": "<jwt-token>"
}
```

Copy token into Postman variable `token`.

### 2.3 Add auth to file requests
For every `/api/files...` endpoint, add:

- Authorization type: **Bearer Token**
- Token: `{{token}}`

---

## 3) Files API endpoints

## 3.1 Get full tree
**GET** `{{baseUrl}}/api/files`

Returns files/folders available for current user.

## 3.2 Get trash items
**GET** `{{baseUrl}}/api/files/trash`

Returns soft-deleted items.

## 3.3 Get file/folder by path
**GET** `{{baseUrl}}/api/files/{{filePath}}`

- File: returns content bytes.
- Folder (or empty file case): `200 OK`.
- Metadata headers: `X-Created-At`, `X-Changed-At`, `X-Type`, `X-Bytes`, `X-Extension`.

## 3.4 Get metadata only
**HEAD** `{{baseUrl}}/api/files/{{filePath}}`

No response body, headers only.

## 3.5 Create file
**POST** `{{baseUrl}}/api/files/{{filePath}}`

Headers:
- `Content-Type: text/plain`

Body (raw text sample):
```text
Hello from Postman.
This is my first file in Docgit.
```

Expected:
- `200 OK` with success message
- `409 Conflict` if file already exists

## 3.6 Create folder
**POST** `{{baseUrl}}/api/files/folders/{{folderPath}}`

Body: *(empty)*

Expected:
- `201 Created` on success
- `409 Conflict` if already exists

## 3.7 Create or update file (upsert)
**PUT** `{{baseUrl}}/api/files/{{filePath}}`

Headers:
- `Content-Type: text/plain`

Body (raw text sample):
```text
Updated content from Postman.
Version changed.
```

Expected: `200 OK`

## 3.8 Soft delete file/folder (move to trash)
**DELETE** `{{baseUrl}}/api/files/{{filePath}}`

Expected: `200 OK`

## 3.9 Permanently delete from trash
**DELETE** `{{baseUrl}}/api/files/trash/{{filePath}}`

Expected: `200 OK`

## 3.10 Restore item from trash
**POST** `{{baseUrl}}/api/files/trash/restore/{{filePath}}`

Body: *(empty)*

Expected:
- `200 OK` on success
- `404 Not Found` if item is not found in trash

## 3.11 Get file history list
**GET** `{{baseUrl}}/api/files/history/{{filePath}}`

Returns versions for the file.

## 3.12 Get specific history version content
**GET** `{{baseUrl}}/api/files/history/{{historyVersion}}/{{filePath}}`

Returns version content.

## 3.13 Get specific history version metadata only
**HEAD** `{{baseUrl}}/api/files/history/{{historyVersion}}/{{filePath}}`

No body; inspect headers.

## 3.14 Restore file from history version
**POST** `{{baseUrl}}/api/files/history/restore/{{historyVersion}}/{{filePath}}`

Body: *(empty)*

Expected:
- `200 OK` on success
- `404 Not Found` if file/version not found

---

## 4) Suggested request order for quick testing

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `POST /api/files/folders/{{folderPath}}`
4. `POST /api/files/{{filePath}}`
5. `PUT /api/files/{{filePath}}`
6. `GET /api/files/history/{{filePath}}`
7. `GET /api/files/history/1/{{filePath}}`
8. `POST /api/files/history/restore/1/{{filePath}}`
9. `DELETE /api/files/{{filePath}}`
10. `GET /api/files/trash`
11. `POST /api/files/trash/restore/{{filePath}}`

---

## 5) Notes

- Paths support nested folders, e.g. `docs/api/readme.md`.
- Use raw text body for plain files; JSON text also works for `.json` files.
- If you get `401 Unauthorized`, token is missing/invalid.
- If you get `404 Not Found`, verify exact path and case.
- For `HEAD` requests, inspect headers in Postman.
