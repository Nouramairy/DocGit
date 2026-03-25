import { Component, input, output, signal, computed } from '@angular/core';
import { DocFile } from '../app';

export interface FlatTreeItem {
  file: DocFile;
  depth: number;
}

@Component({
  selector: 'app-side-bar',
  imports: [],
  templateUrl: './side-bar.html',
  styleUrl: './side-bar.css',
})
export class SideBar {
  files = input<DocFile[]>([]);
  activeFile = input<DocFile | null>(null);
  searchQuery = input('');

  fileSelect = output<DocFile>();
  addFolderClick = output<void>();
  addFileClick = output<string | null>();
  addSubFolderClick = output<DocFile>();
  deleteItem = output<DocFile>();

  expandedFolders = signal<Set<string>>(new Set(['1', '4', '7']));

  flatTree = computed<FlatTreeItem[]>(() => {
    const query = this.searchQuery().toLowerCase();
    const source = query ? this.filterFiles(this.files(), query) : this.files();
    return this.flattenTree(source, 0);
  });

  toggleFolder(folderId: string): void {
    this.expandedFolders.update(set => {
      const next = new Set(set);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  isFolderExpanded(folderId: string): boolean {
    return this.expandedFolders().has(folderId);
  }

  isActive(file: DocFile): boolean {
    return this.activeFile()?.id === file.id;
  }

  selectFile(file: DocFile): void {
    this.fileSelect.emit(file);
  }

  createFile(parentId: string | null): void {
    this.addFileClick.emit(parentId);
  }

  requestSubFolder(folder: DocFile): void {
    this.expandedFolders.update(set => {
      const next = new Set(set);
      next.add(folder.id);
      return next;
    });
    this.addSubFolderClick.emit(folder);
  }

  getFileIcon(file: DocFile): string {
    if (file.type === 'folder') {
      return this.isFolderExpanded(file.id) ? 'folder_open' : 'folder';
    }
    if (file.name.endsWith('.md')) return 'article';
    return 'description';
  }

  getIndentPx(depth: number, isFile: boolean): string {
    const base = isFile ? (16 + depth * 20) : (16 + depth * 20);
    return base + 'px';
  }

  private flattenTree(items: DocFile[], depth: number): FlatTreeItem[] {
    const result: FlatTreeItem[] = [];
    for (const item of items) {
      result.push({ file: item, depth });
      if (item.type === 'folder' && this.isFolderExpanded(item.id) && item.children) {
        result.push(...this.flattenTree(item.children, depth + 1));
      }
    }
    return result;
  }

  private filterFiles(files: DocFile[], query: string): DocFile[] {
    const result: DocFile[] = [];
    for (const file of files) {
      if (file.name.toLowerCase().includes(query)) {
        result.push(file);
      } else if (file.children) {
        const filtered = this.filterFiles(file.children, query);
        if (filtered.length) {
          result.push({ ...file, children: filtered });
        }
      }
    }
    return result;
  }
}
