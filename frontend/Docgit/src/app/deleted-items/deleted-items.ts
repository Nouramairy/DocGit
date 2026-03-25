import { Component, input, output } from '@angular/core';
import { DocFile } from '../app';

export interface DeletedEntry {
  file: DocFile;
  path: string;
  deletedAt: Date;
}

@Component({
  selector: 'app-deleted-items',
  imports: [],
  templateUrl: './deleted-items.html',
  styleUrl: './deleted-items.css',
})
export class DeletedItems {
  items = input<DeletedEntry[]>([]);

  close = output<void>();
  restore = output<string>();
  permanentDelete = output<string>();
  emptyTrash = output<void>();

  getIcon(entry: DeletedEntry): string {
    return entry.file.type === 'folder' ? 'folder' : 'article';
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('panel-overlay')) {
      this.close.emit();
    }
  }
}
