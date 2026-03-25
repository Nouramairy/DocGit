import { Component, output, signal } from '@angular/core';

interface SettingToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: string;
}

@Component({
  selector: 'app-settings-panel',
  imports: [],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  close = output<void>();

  activeTab = signal<'general' | 'editor' | 'git'>('general');

  generalSettings = signal<SettingToggle[]>([
    { id: 'autosave', label: 'Auto-save', description: 'Automatically save documents while editing', enabled: true, icon: 'save' },
    { id: 'spellcheck', label: 'Spell Check', description: 'Highlight misspelled words', enabled: true, icon: 'spellcheck' },
    { id: 'notifications', label: 'Notifications', description: 'Get notified about document changes', enabled: false, icon: 'notifications' },
    { id: 'darkmode', label: 'Dark Mode', description: 'Use dark theme for the interface', enabled: false, icon: 'dark_mode' },
  ]);

  editorSettings = signal<SettingToggle[]>([
    { id: 'wordwrap', label: 'Word Wrap', description: 'Wrap long lines at editor boundary', enabled: true, icon: 'wrap_text' },
    { id: 'linenumbers', label: 'Line Numbers', description: 'Show line numbers in the editor', enabled: false, icon: 'format_list_numbered' },
    { id: 'minimap', label: 'Minimap', description: 'Show document minimap on the side', enabled: false, icon: 'map' },
    { id: 'markdown_preview', label: 'Markdown Preview', description: 'Show live preview of Markdown', enabled: false, icon: 'preview' },
  ]);

  gitSettings = signal<SettingToggle[]>([
    { id: 'autocommit', label: 'Auto-commit', description: 'Automatically commit changes on save', enabled: false, icon: 'commit' },
    { id: 'showdiff', label: 'Show Diff', description: 'Highlight changes since last commit', enabled: true, icon: 'difference' },
    { id: 'branchprotect', label: 'Branch Protection', description: 'Require review before merging to main', enabled: true, icon: 'shield' },
  ]);

  toggleSetting(settingsKey: 'generalSettings' | 'editorSettings' | 'gitSettings', id: string): void {
    const settings = this[settingsKey];
    settings.update(list =>
      list.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('panel-overlay')) {
      this.close.emit();
    }
  }
}
