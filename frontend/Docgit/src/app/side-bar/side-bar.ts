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
  /** Parent folder API path, or null for root */
  addFileClick = output<string | null>();
  addSubFolderClick = output<DocFile>();
  deleteItem = output<DocFile>();
  uploadFile = output<{ name: string; content: string }>();

  expandedFolders = signal<Set<string>>(new Set());

  flatTree = computed<FlatTreeItem[]>(() => {
    const query = this.searchQuery().toLowerCase();
    const source = query ? this.filterFiles(this.files(), query) : this.files();
    return this.flattenTree(source, 0);
  });

  toggleFolder(folderPath: string): void {
    this.expandedFolders.update((set) => {
      const next = new Set(set);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }

  isFolderExpanded(folderPath: string): boolean {
    return this.expandedFolders().has(folderPath);
  }

  isActive(file: DocFile): boolean {
    return this.activeFile()?.id === file.id;
  }

  selectFile(file: DocFile): void {
    this.fileSelect.emit(file);
  }

  createFile(parentPath: string | null): void {
    this.addFileClick.emit(parentPath);
  }

  requestSubFolder(folder: DocFile): void {
    this.expandedFolders.update((set) => {
      const next = new Set(set);
      next.add(folder.id);
      return next;
    });
    this.addSubFolderClick.emit(folder);
  }

  triggerUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.html,.css,.js,.ts,.json,.xml,.csv,.yaml,.yml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadFile.emit({ name: file.name, content: reader.result as string });
      };
      reader.readAsText(file);
    };
    input.click();
  }

  getFileIcon(file: DocFile): string {
    if (file.type === 'folder') {
      return this.isFolderExpanded(file.id) ? 'folder_open' : 'folder';
    }
    if (file.name.endsWith('.md')) return 'article';
    return 'description';
  }

  getIndentPx(depth: number, isFile: boolean): string {
    const base = isFile ? 16 + depth * 20 : 16 + depth * 20;
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
