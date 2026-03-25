import { Component, output, signal } from '@angular/core';

interface DeletedItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  deletedAt: Date;
  originalPath: string;
}

@Component({
  selector: 'app-deleted-items',
  imports: [],
  templateUrl: './deleted-items.html',
  styleUrl: './deleted-items.css',
})
export class DeletedItems {
  close = output<void>();

  deletedItems = signal<DeletedItem[]>([
    {
      id: 'd1',
      name: 'Old Draft.md',
      type: 'file',
      deletedAt: new Date('2026-03-20'),
      originalPath: 'My Documents/Old Draft.md'
    },
    {
      id: 'd2',
      name: 'Archive',
      type: 'folder',
      deletedAt: new Date('2026-03-15'),
      originalPath: 'Archive'
    },
    {
      id: 'd3',
      name: 'Notes 2025.md',
      type: 'file',
      deletedAt: new Date('2026-03-10'),
      originalPath: 'Research/Notes 2025.md'
    }
  ]);

  getIcon(item: DeletedItem): string {
    return item.type === 'folder' ? 'folder' : 'article';
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  restoreItem(id: string): void {
    this.deletedItems.update(items => items.filter(i => i.id !== id));
  }

  permanentDelete(id: string): void {
    this.deletedItems.update(items => items.filter(i => i.id !== id));
  }

  emptyTrash(): void {
    this.deletedItems.set([]);
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('panel-overlay')) {
      this.close.emit();
    }
  }
}
