import { Component, input, output, signal, computed } from '@angular/core';
import { DocFile } from '../app';

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

  expandedFolders = signal<Set<string>>(new Set(['1', '4']));

  filteredFiles = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.files();
    return this.filterFiles(this.files(), query);
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

  getFileIcon(file: DocFile): string {
    if (file.type === 'folder') {
      return this.isFolderExpanded(file.id) ? 'folder_open' : 'folder';
    }
    if (file.name.endsWith('.md')) return 'article';
    return 'description';
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
