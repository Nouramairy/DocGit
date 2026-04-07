import { Component, computed, signal, inject, afterNextRender, OnDestroy } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import { SideBar } from './side-bar/side-bar';
import { SreachBar } from './sreach-bar/sreach-bar';
import { Editor } from './editor/editor';
import { AddFolder } from './add-folder/add-folder';
import { DeletedItems } from './deleted-items/deleted-items';
import { SettingsPanel } from './settings-panel/settings-panel';
import { Account } from './account/account';
import { LogIn } from './log-in/log-in';
import { AddSubFolder } from './add-sub-folder/add-sub-folder';
import {
  DocApiService,
  DocFile,
  FileHistoryEntryDto,
  TrashItemDto,
} from './services/doc-api.service';
import { RealtimeEventsService } from './services/realtime-events.service';

export type { DocFile };

export interface DeletedEntry {
  file: DocFile;
  path: string;
  deletedAt: Date;
}

@Component({
  selector: 'app-root',
  imports: [
    SideBar,
    SreachBar,
    Editor,
    AddFolder,
    AddSubFolder,
    DeletedItems,
    SettingsPanel,
    Account,
    LogIn,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  private readonly api = inject(DocApiService);
  private readonly realtime = inject(RealtimeEventsService);
  private realtimeSub: Subscription | null = null;

  protected readonly title = signal('DocGit');
  protected isAuthenticated = signal(false);
  protected userName = signal('');
  protected userEmail = signal('');
  protected sidebarCollapsed = signal(false);
  protected showAddFolder = signal(false);
  protected showAddSubFolder = signal(false);
  protected subFolderParent = signal<DocFile | null>(null);
  protected showDeletedItems = signal(false);
  protected showSettings = signal(false);
  protected showAccount = signal(false);
  protected searchQuery = signal('');
  protected activeFile = signal<DocFile | null>(null);
  protected deletedFiles = signal<DeletedEntry[]>([]);
  protected showAddFile = signal(false);
  protected addFileParentPath = signal<string | null>(null);
  protected files = signal<DocFile[]>([]);
  protected isTreeLoading = signal(false);
  protected editorVersionCount = signal(0);
  protected fileHistory = signal<FileHistoryEntryDto[]>([]);
  protected editorContentSyncRev = signal(0);
  protected saveInFlight = signal(false);
  protected restoreInFlight = signal(false);
  protected avatarInitials = computed(() => {
    const n = this.userName().trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  });

  protected documentCount = computed(() => this.countFiles(this.files()));

  constructor() {
    afterNextRender(() => this.tryRestoreSession());
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = null;
    void this.realtime.stop();
  }

  private tryRestoreSession(): void {
    if (!this.api.hasToken()) return;
    const p = this.api.getStoredProfile();
    if (p) {
      this.userName.set(p.name);
      this.userEmail.set(p.email);
    }
    this.refreshFileTree(true);
    this.startRealtime();
  }

  private startRealtime(): void {
    if (this.realtimeSub) return;

    this.realtimeSub = this.realtime.events$.subscribe((evt) => {
      console.info('[App] Realtime file event received:', evt);
      this.refreshFileTree();
      if (this.showDeletedItems()) {
        this.refreshTrashList();
      }
    });

    void this.realtime.start();
  }

  private stopRealtime(): void {
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = null;
    void this.realtime.stop();
  }

  private countFiles(files: DocFile[]): number {
    let count = 0;
    for (const f of files) {
      if (f.type === 'file') count++;
      if (f.children) count += this.countFiles(f.children);
    }
    return count;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleAccount(): void {
    this.showAccount.update((v) => !v);
  }

  onLoginSuccess(user: { name: string; email: string }): void {
    this.userName.set(user.name);
    this.userEmail.set(user.email);
    this.isAuthenticated.set(true);
    this.refreshFileTree(false);
    this.startRealtime();
  }

  onLogOut(): void {
    this.stopRealtime();
    this.api.setAuthToken(null);
    this.api.clearStoredProfile();
    this.showAccount.set(false);
    this.isAuthenticated.set(false);
    this.userName.set('');
    this.userEmail.set('');
    this.activeFile.set(null);
    this.files.set([]);
    this.deletedFiles.set([]);
    this.editorVersionCount.set(0);
    this.fileHistory.set([]);
  }

  private refreshFileTree(setAuthOnSuccess = false): void {
    this.isTreeLoading.set(true);
    this.api.getTree().subscribe({
      next: (tree) => {
        this.files.set(tree);
        this.isTreeLoading.set(false);
        if (setAuthOnSuccess) {
          this.isAuthenticated.set(true);
        }
      },
      error: () => {
        this.isTreeLoading.set(false);
        this.api.setAuthToken(null);
        this.api.clearStoredProfile();
        this.isAuthenticated.set(false);
      },
    });
  }

  onFileSelect(file: DocFile): void {
    if (file.type !== 'file') return;
    this.editorContentSyncRev.update((r) => r + 1);
    this.activeFile.set({ ...file, content: '' });
    this.editorVersionCount.set(0);
    this.fileHistory.set([]);
    this.api.getFileText(file.id).subscribe({
      next: (text) => {
        const current = this.activeFile();
        if (current?.id === file.id) {
          this.activeFile.set({ ...current, content: text });
          this.editorContentSyncRev.update((r) => r + 1);
        }
      },
      error: () => {
        const current = this.activeFile();
        if (current?.id === file.id) {
          this.activeFile.set({ ...current, content: '' });
          this.editorContentSyncRev.update((r) => r + 1);
        }
      },
    });
    this.api.getFileHistory(file.id).subscribe({
      next: (h) => {
        if (this.activeFile()?.id === file.id) {
          this.editorVersionCount.set(h.length);
          this.fileHistory.set(h);
        }
      },
      error: () => {
        if (this.activeFile()?.id === file.id) {
          this.editorVersionCount.set(0);
          this.fileHistory.set([]);
        }
      },
    });
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  onAddFolder(name: string): void {
    const path = name.trim();
    if (!path) return;
    this.api.createFolder(path).subscribe({
      next: () => {
        this.showAddFolder.set(false);
        this.refreshFileTree();
      },
      error: () => {
        this.showAddFolder.set(false);
        this.refreshFileTree();
      },
    });
  }

  onRequestSubFolder(folder: DocFile): void {
    this.subFolderParent.set(folder);
    this.showAddSubFolder.set(true);
  }

  onAddSubFolder(event: { name: string; parentId: string }): void {
    const folderName = event.name.trim();
    if (!folderName) return;
    const parentPath = event.parentId;
    const path = parentPath ? `${parentPath}/${folderName}` : folderName;
    this.api.createFolder(path).subscribe({
      next: () => {
        this.showAddSubFolder.set(false);
        this.subFolderParent.set(null);
        this.refreshFileTree();
      },
      error: () => {
        this.showAddSubFolder.set(false);
        this.subFolderParent.set(null);
        this.refreshFileTree();
      },
    });
  }

  onAddFile(parentPath: string | null): void {
    this.addFileParentPath.set(parentPath);
    this.showAddFile.set(true);
  }

  onCreateFile(name: string): void {
    const raw = name.trim();
    if (!raw) return;
    const fileName = raw.endsWith('.md') ? raw : `${raw}.md`;
    const parentPath = this.addFileParentPath();
    const path = parentPath ? `${parentPath}/${fileName}` : fileName;
    this.api.createFile(path, '').subscribe({
      next: () => {
        this.showAddFile.set(false);
        this.addFileParentPath.set(null);
        this.refreshFileTree();
        const newFile: DocFile = {
          id: path,
          name: fileName,
          type: 'file',
          parent: parentPath,
          updatedAt: new Date(),
          createdAt: new Date(),
          content: '',
        };
        this.activeFile.set(newFile);
        this.editorVersionCount.set(0);
        this.fileHistory.set([]);
        this.editorContentSyncRev.update((r) => r + 1);
      },
      error: () => {
        this.showAddFile.set(false);
        this.addFileParentPath.set(null);
        this.refreshFileTree();
      },
    });
  }

  onImportFile(event: { name: string; content: string }): void {
    const path = event.name;
    this.api.createFile(path, event.content).subscribe({
      next: () => {
        this.refreshFileTree();
        const newFile: DocFile = {
          id: path,
          name: path.split('/').pop() ?? path,
          type: 'file',
          parent: null,
          updatedAt: new Date(),
          createdAt: new Date(),
          content: event.content,
        };
        this.activeFile.set(newFile);
        this.editorVersionCount.set(0);
        this.fileHistory.set([]);
        this.editorContentSyncRev.update((r) => r + 1);
        this.api.getFileHistory(path).subscribe({
          next: (h) => {
            if (this.activeFile()?.id === path) {
              this.editorVersionCount.set(h.length);
              this.fileHistory.set(h);
            }
          },
          error: () => {},
        });
      },
      error: () => this.refreshFileTree(),
    });
  }

  onContentChange(content: string): void {
    const file = this.activeFile();
    if (!file) return;
    const updated = { ...file, content, updatedAt: new Date() };
    this.activeFile.set(updated);
  }

  onSaveNow(): void {
    const file = this.activeFile();
    if (!file || file.type !== 'file') return;
    this.saveInFlight.set(true);
    this.api.putFile(file.id, file.content ?? '').subscribe({
      next: () => {
        const active = this.activeFile();
        if (active?.id !== file.id) {
          this.saveInFlight.set(false);
          return;
        }
        this.api.getFileHistory(file.id).subscribe({
          next: (h) => {
            this.editorVersionCount.set(h.length);
            this.fileHistory.set(h);
            this.saveInFlight.set(false);
          },
          error: () => this.saveInFlight.set(false),
        });
      },
      error: () => this.saveInFlight.set(false),
    });
  }

  onRestoreHistoryVersion(version: number): void {
    const file = this.activeFile();
    if (!file || file.type !== 'file') return;
    this.restoreInFlight.set(true);
    this.api.restoreFileFromHistory(file.id, version).subscribe({
      next: () => {
        this.api.getFileText(file.id).subscribe({
          next: (text) => {
            const current = this.activeFile();
            if (current?.id === file.id) {
              this.activeFile.set({ ...current, content: text, updatedAt: new Date() });
              this.editorContentSyncRev.update((r) => r + 1);
            }
            this.api.getFileHistory(file.id).subscribe({
              next: (h) => {
                if (this.activeFile()?.id === file.id) {
                  this.editorVersionCount.set(h.length);
                  this.fileHistory.set(h);
                }
                this.restoreInFlight.set(false);
              },
              error: () => this.restoreInFlight.set(false),
            });
          },
          error: () => this.restoreInFlight.set(false),
        });
      },
      error: () => this.restoreInFlight.set(false),
    });
  }

  onDeleteItem(item: DocFile): void {
    this.api.softDelete(item.id).subscribe({
      next: () => {
        if (this.activeFile()?.id === item.id) {
          this.activeFile.set(null);
          this.editorVersionCount.set(0);
          this.fileHistory.set([]);
        }
        this.refreshFileTree();
        if (this.showDeletedItems()) {
          this.refreshTrashList();
        }
      },
      error: () => this.refreshFileTree(),
    });
  }

  openDeletedItems(): void {
    this.refreshTrashList();
    this.showDeletedItems.set(true);
  }

  private trashDtoToEntry(t: TrashItemDto): DeletedEntry {
    const segments = t.path.split('/');
    const parent =
      segments.length > 1 ? segments.slice(0, -1).join('/') : null;
    const file: DocFile = {
      id: t.path,
      name: t.name,
      type: t.isFile ? 'file' : 'folder',
      parent,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    return {
      file,
      path: t.path,
      deletedAt: t.deletedAt
        ? new Date(t.deletedAt.replace(' ', 'T') + 'Z')
        : new Date(),
    };
  }

  private refreshTrashList(): void {
    this.api.getTrash().subscribe({
      next: (list) => this.deletedFiles.set(list.map((t) => this.trashDtoToEntry(t))),
      error: () => {},
    });
  }

  onRestoreItem(path: string): void {
    this.api.restoreFromTrash(path).subscribe({
      next: () => {
        this.refreshTrashList();
        this.refreshFileTree();
      },
      error: () => {
        this.refreshTrashList();
        this.refreshFileTree();
      },
    });
  }

  onPermanentDelete(path: string): void {
    this.api.permanentDeleteFromTrash(path).subscribe({
      next: () => this.refreshTrashList(),
      error: () => this.refreshTrashList(),
    });
  }

  onEmptyTrash(): void {
    const paths = this.deletedFiles().map((e) => e.path);
    if (paths.length === 0) return;
    forkJoin(paths.map((p) => this.api.permanentDeleteFromTrash(p))).subscribe({
      next: () => this.refreshTrashList(),
      error: () => this.refreshTrashList(),
    });
  }
}
