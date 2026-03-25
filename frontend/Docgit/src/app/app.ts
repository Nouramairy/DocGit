import { Component, signal } from '@angular/core';
import { SideBar } from './side-bar/side-bar';
import { SreachBar } from './sreach-bar/sreach-bar';
import { Editor } from './editor/editor';
import { AddFolder } from './add-folder/add-folder';
import { DeletedItems } from './deleted-items/deleted-items';
import { SettingsPanel } from './settings-panel/settings-panel';
import { Account } from './account/account';
import { LogIn } from './log-in/log-in';
import { AddSubFolder } from './add-sub-folder/add-sub-folder';
import { CollaboratorPanel } from './collaborator-panel/collaborator-panel';

export interface DocFile {
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

@Component({
  selector: 'app-root',
  imports: [SideBar, SreachBar, Editor, AddFolder, AddSubFolder, DeletedItems, SettingsPanel, Account, LogIn, CollaboratorPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
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
  protected showCollaborators = signal(false);
  protected searchQuery = signal('');
  protected activeFile = signal<DocFile | null>(null);
  protected deletedFiles = signal<{ file: DocFile; path: string; deletedAt: Date }[]>([]);
  protected showAddFile = signal(false);
  protected addFileParentId = signal<string | null>(null);

  protected files = signal<DocFile[]>([
    {
      id: '1',
      name: 'My Documents',
      type: 'folder',
      parent: null,
      updatedAt: new Date('2026-03-20'),
      createdAt: new Date('2026-01-15'),
      children: [
        {
          id: '2',
          name: 'Project Proposal.md',
          type: 'file',
          parent: '1',
          updatedAt: new Date('2026-03-24'),
          createdAt: new Date('2026-02-10'),
          content: '# Project Proposal\n\nThis is a sample document to demonstrate the DocGit editor.\n\n## Overview\n\nDocGit combines the collaborative editing power of Google Docs with the version control capabilities of GitHub.\n\n## Features\n\n- Real-time collaborative editing\n- Git-based version history\n- Markdown support\n- File and folder organization\n\n## Timeline\n\n| Phase | Duration | Status |\n|-------|----------|--------|\n| Design | 2 weeks | Complete |\n| Frontend | 3 weeks | In Progress |\n| Backend | 4 weeks | Planned |\n| Testing | 2 weeks | Planned |'
        },
        {
          id: '3',
          name: 'Meeting Notes.md',
          type: 'file',
          parent: '1',
          updatedAt: new Date('2026-03-22'),
          createdAt: new Date('2026-03-01'),
          content: '# Meeting Notes - March 22\n\n## Attendees\n- Alice\n- Bob\n- Charlie\n\n## Agenda\n1. Sprint review\n2. Architecture decisions\n3. Next steps\n\n## Action Items\n- [ ] Set up CI/CD pipeline\n- [ ] Review pull requests\n- [x] Update documentation'
        },
        {
          id: '7',
          name: 'Drafts',
          type: 'folder',
          parent: '1',
          updatedAt: new Date('2026-03-23'),
          createdAt: new Date('2026-03-10'),
          children: [
            {
              id: '8',
              name: 'Blog Post Draft.md',
              type: 'file',
              parent: '7',
              updatedAt: new Date('2026-03-23'),
              createdAt: new Date('2026-03-12'),
              content: '# Introducing DocGit\n\nA blog post about the launch of DocGit...'
            },
            {
              id: '9',
              name: 'v2 Ideas',
              type: 'folder',
              parent: '7',
              updatedAt: new Date('2026-03-21'),
              createdAt: new Date('2026-03-15'),
              children: [
                {
                  id: '10',
                  name: 'Real-time Collab.md',
                  type: 'file',
                  parent: '9',
                  updatedAt: new Date('2026-03-21'),
                  createdAt: new Date('2026-03-15'),
                  content: '# Real-time Collaboration\n\nIdeas for implementing real-time collaborative editing using CRDTs.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: '4',
      name: 'Research',
      type: 'folder',
      parent: null,
      updatedAt: new Date('2026-03-18'),
      createdAt: new Date('2026-02-01'),
      children: [
        {
          id: '5',
          name: 'Literature Review.md',
          type: 'file',
          parent: '4',
          updatedAt: new Date('2026-03-18'),
          createdAt: new Date('2026-02-15'),
          content: '# Literature Review\n\nA comprehensive review of related work in collaborative document editing and version control systems.'
        }
      ]
    },
    {
      id: '6',
      name: 'README.md',
      type: 'file',
      parent: null,
      updatedAt: new Date('2026-03-25'),
      createdAt: new Date('2026-01-10'),
      content: '# DocGit\n\nA modern document editor with Git-powered version control.\n\n## Getting Started\n\nClone the repository and run `npm start` to launch the development server.'
    }
  ]);

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleAccount(): void {
    this.showAccount.update(v => !v);
  }

  onLoginSuccess(user: { name: string; email: string }): void {
    this.userName.set(user.name);
    this.userEmail.set(user.email);
    this.isAuthenticated.set(true);
  }

  onLogOut(): void {
    this.showAccount.set(false);
    this.isAuthenticated.set(false);
    this.userName.set('');
    this.userEmail.set('');
    this.activeFile.set(null);
  }

  onFileSelect(file: DocFile): void {
    if (file.type === 'file') {
      this.activeFile.set(file);
    }
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  onAddFolder(name: string): void {
    const newFolder: DocFile = {
      id: Date.now().toString(),
      name,
      type: 'folder',
      parent: null,
      updatedAt: new Date(),
      createdAt: new Date(),
      children: []
    };
    this.files.update(f => [...f, newFolder]);
    this.showAddFolder.set(false);
  }

  onRequestSubFolder(folder: DocFile): void {
    this.subFolderParent.set(folder);
    this.showAddSubFolder.set(true);
  }

  onAddSubFolder(event: { name: string; parentId: string }): void {
    const newFolder: DocFile = {
      id: Date.now().toString(),
      name: event.name,
      type: 'folder',
      parent: event.parentId,
      updatedAt: new Date(),
      createdAt: new Date(),
      children: []
    };
    this.files.update(files => this.addFileToFolder(files, event.parentId, newFolder));
    this.showAddSubFolder.set(false);
    this.subFolderParent.set(null);
  }

  onAddFile(parentId: string | null): void {
    this.addFileParentId.set(parentId);
    this.showAddFile.set(true);
  }

  onCreateFile(name: string): void {
    const parentId = this.addFileParentId();
    const fileName = name.endsWith('.md') ? name : name + '.md';
    const newFile: DocFile = {
      id: Date.now().toString(),
      name: fileName,
      type: 'file',
      parent: parentId,
      updatedAt: new Date(),
      createdAt: new Date(),
      content: ''
    };
    if (parentId) {
      this.files.update(files => this.addFileToFolder(files, parentId, newFile));
    } else {
      this.files.update(f => [...f, newFile]);
    }
    this.activeFile.set(newFile);
    this.showAddFile.set(false);
    this.addFileParentId.set(null);
  }

  onRenameItem(event: { id: string; newName: string }): void {
    this.files.update(files => this.renameInTree(files, event.id, event.newName));
    const active = this.activeFile();
    if (active && active.id === event.id) {
      this.activeFile.set({ ...active, name: event.newName });
    }
  }

  onContentChange(content: string): void {
    const file = this.activeFile();
    if (file) {
      const updated = { ...file, content, updatedAt: new Date() };
      this.activeFile.set(updated);
      this.files.update(files => this.updateFileInTree(files, updated));
    }
  }

  onDeleteItem(item: DocFile): void {
    const path = this.getItemPath(this.files(), item.id);
    this.deletedFiles.update(list => [
      { file: item, path, deletedAt: new Date() },
      ...list
    ]);
    this.files.update(files => this.removeFromTree(files, item.id));
    if (this.activeFile()?.id === item.id) {
      this.activeFile.set(null);
    }
  }

  onRestoreItem(id: string): void {
    const entry = this.deletedFiles().find(d => d.file.id === id);
    if (!entry) return;
    const file = entry.file;
    if (file.parent) {
      this.files.update(files => this.addFileToFolder(files, file.parent!, file));
    } else {
      this.files.update(f => [...f, file]);
    }
    this.deletedFiles.update(list => list.filter(d => d.file.id !== id));
  }

  onPermanentDelete(id: string): void {
    this.deletedFiles.update(list => list.filter(d => d.file.id !== id));
  }

  onEmptyTrash(): void {
    this.deletedFiles.set([]);
  }

  private removeFromTree(files: DocFile[], id: string): DocFile[] {
    return files
      .filter(f => f.id !== id)
      .map(f => f.children
        ? { ...f, children: this.removeFromTree(f.children, id) }
        : f
      );
  }

  private getItemPath(files: DocFile[], targetId: string, prefix = ''): string {
    for (const f of files) {
      const currentPath = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id === targetId) return currentPath;
      if (f.children) {
        const found = this.getItemPath(f.children, targetId, currentPath);
        if (found) return found;
      }
    }
    return '';
  }

  private addFileToFolder(files: DocFile[], folderId: string, newFile: DocFile): DocFile[] {
    return files.map(f => {
      if (f.id === folderId && f.type === 'folder') {
        return { ...f, children: [...(f.children || []), newFile] };
      }
      if (f.children) {
        return { ...f, children: this.addFileToFolder(f.children, folderId, newFile) };
      }
      return f;
    });
  }

  private renameInTree(files: DocFile[], id: string, newName: string): DocFile[] {
    return files.map(f => {
      if (f.id === id) {
        return { ...f, name: newName, updatedAt: new Date() };
      }
      if (f.children) {
        return { ...f, children: this.renameInTree(f.children, id, newName) };
      }
      return f;
    });
  }

  private updateFileInTree(files: DocFile[], updated: DocFile): DocFile[] {
    return files.map(f => {
      if (f.id === updated.id) return updated;
      if (f.children) {
        return { ...f, children: this.updateFileInTree(f.children, updated) };
      }
      return f;
    });
  }
}
