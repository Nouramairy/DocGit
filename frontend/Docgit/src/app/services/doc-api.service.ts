import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

/** Matches GET /api/files tree nodes from Fileservice.BuildNestTree */
export interface ApiTreeNode {
  file: boolean;
  created: string;
  changed: string;
  bytes: number;
  extension?: string;
  content?: Record<string, ApiTreeNode>;
}

export interface DocFile {
  /** Full API path, e.g. "Notes/doc.md" */
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent: string | null;
  children?: DocFile[];
  updatedAt: Date;
  createdAt: Date;
  content?: string;
  isDeleted?: boolean;
}

export interface TrashItemDto {
  name: string;
  path: string;
  isFile: boolean;
  deletedAt: string | null;
}

export interface FileHistoryEntryDto {
  version: number;
  savedAt: string;
  bytes: number;
}

const TOKEN_KEY = 'docgit_token';
const USER_KEY = 'docgit_user';

/** Backend `http` profile (launchSettings.json). Override if your API runs elsewhere. */
const API_BASE_URL = 'http://localhost:5135';

@Injectable({ providedIn: 'root' })
export class DocApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly baseUrl = API_BASE_URL;

  hasToken(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setAuthToken(token: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  setStoredProfile(name: string, email: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(USER_KEY, JSON.stringify({ name, email }));
  }

  getStoredProfile(): { name: string; email: string } | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as { name?: string; email?: string };
      return {
        name: o.name ?? '',
        email: o.email ?? '',
      };
    } catch {
      return null;
    }
  }

  clearStoredProfile(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(USER_KEY);
  }

  private authHeaders(contentType?: string): HttpHeaders {
    const t = this.getToken();
    let h = new HttpHeaders();
    if (t) h = h.set('Authorization', `Bearer ${t}`);
    if (contentType) h = h.set('Content-Type', contentType);
    return h;
  }

  /** Encode each segment for URLs like /api/files/a/b/c.md */
  encodePath(path: string): string {
    return path
      .split('/')
      .filter((s) => s.length > 0)
      .map((s) => encodeURIComponent(s))
      .join('/');
  }

  login(userName: string, password: string): Observable<string> {
    return this.http
      .post<{ token: string }>(`${this.baseUrl}/api/login`, { userName, password })
      .pipe(map((r) => r.token));
  }

  register(body: {
    userName: string;
    password: string;
    email: string;
    name: string;
  }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/register`, body);
  }

  getTree(): Observable<DocFile[]> {
    return this.http
      .get<Record<string, ApiTreeNode>>(`${this.baseUrl}/api/files`, {
        headers: this.authHeaders(),
      })
      .pipe(map((obj) => this.treeToDocFiles(obj, null)));
  }

  getTrash(): Observable<TrashItemDto[]> {
    return this.http.get<TrashItemDto[]>(`${this.baseUrl}/api/files/trash`, {
      headers: this.authHeaders(),
    });
  }

  getFileText(path: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/api/files/${this.encodePath(path)}`, {
      headers: this.authHeaders(),
      responseType: 'text',
    });
  }

  getFileHistory(path: string): Observable<FileHistoryEntryDto[]> {
    return this.http.get<FileHistoryEntryDto[]>(
      `${this.baseUrl}/api/files/history/${this.encodePath(path)}`,
      { headers: this.authHeaders() },
    );
  }

  putFile(path: string, text: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/api/files/${this.encodePath(path)}`, text, {
      headers: this.authHeaders('text/plain; charset=UTF-8'),
    });
  }

  createFile(path: string, text: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/files/${this.encodePath(path)}`, text, {
      headers: this.authHeaders('text/plain; charset=UTF-8'),
    });
  }

  /** Empty body, path must not look like a file (no extension) for folder creation. */
  createFolder(path: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/files/${this.encodePath(path)}`, '', {
      headers: this.authHeaders(),
    });
  }

  softDelete(path: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/files/${this.encodePath(path)}`, {
      headers: this.authHeaders(),
    });
  }

  restoreFromTrash(path: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/api/files/trash/restore/${this.encodePath(path)}`,
      '',
      { headers: this.authHeaders() },
    );
  }

  permanentDeleteFromTrash(path: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/files/trash/${this.encodePath(path)}`, {
      headers: this.authHeaders(),
    });
  }

  handleAuthError(err: HttpErrorResponse): Observable<never> {
    if (err.status === 401) {
      this.setAuthToken(null);
    }
    return throwError(() => err);
  }

  private treeToDocFiles(
    obj: Record<string, ApiTreeNode> | null | undefined,
    parentPath: string | null,
  ): DocFile[] {
    if (!obj) return [];
    const result: DocFile[] = [];
    const names = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      const node = obj[name];
      const path = parentPath ? `${parentPath}/${name}` : name;
      if (node.file) {
        result.push({
          id: path,
          name,
          type: 'file',
          parent: parentPath,
          updatedAt: this.parseApiDate(node.changed),
          createdAt: this.parseApiDate(node.created),
        });
      } else {
        const children = this.treeToDocFiles(node.content ?? {}, path);
        result.push({
          id: path,
          name,
          type: 'folder',
          parent: parentPath,
          updatedAt: this.parseApiDate(node.changed),
          createdAt: this.parseApiDate(node.created),
          children,
        });
      }
    }
    return result;
  }

  private parseApiDate(s: string): Date {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
}
