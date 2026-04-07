import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { DocApiService } from './doc-api.service';

export interface FileEventMessage {
  type: number;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeEventsService {
  private readonly api = inject(DocApiService);
  private readonly platformId = inject(PLATFORM_ID);

  private connection: signalR.HubConnection | null = null;
  private readonly eventsSubject = new Subject<FileEventMessage>();
  readonly events$ = this.eventsSubject.asObservable();

  async start(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.api.getToken()) {
      console.info('[SignalR] skip start: no auth token');
      return;
    }
    if (this.connection && this.connection.state !== signalR.HubConnectionState.Disconnected) {
      console.info('[SignalR] already started. state=', this.connection.state);
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.api.baseUrl}/api/events/signalr`, {
        accessTokenFactory: () => this.api.getToken() ?? '',
      })
      .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.connection.on('Connected', (payload: unknown) => {
      console.info('[SignalR] server Connected payload:', payload);
    });

    this.connection.on('FileChangeEvent', (type: number, path: string) => {
      console.info('[SignalR] Event:', {
        type,
        typeName: this.eventName(type),
        path,
      });
      this.eventsSubject.next({ type, path });
    });

    this.connection.onreconnecting((error?: Error) => {
      console.warn('[SignalR] reconnecting...', error);
    });

    this.connection.onreconnected((connectionId?: string) => {
      console.info('[SignalR] reconnected. connectionId=', connectionId);
    });

    this.connection.onclose((error?: Error) => {
      console.warn('[SignalR] closed.', error);
    });

    try {
      await this.connection.start();
      console.info('[SignalR] connected. connectionId=', this.connection.connectionId);
    } catch (error) {
      console.error('[SignalR] failed to connect.', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.connection) return;
    await this.connection.stop();
    this.connection = null;
    console.info('[SignalR] stopped');
  }

  async joinGroup(groupName: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('JoinGroup', groupName);
    console.info('[SignalR] joined group:', groupName);
  }

  async leaveGroup(groupName: string): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('LeaveGroup', groupName);
    console.info('[SignalR] left group:', groupName);
  }

  private eventName(type: number): string {
    switch (type) {
      case 0:
        return 'FileCreated';
      case 1:
        return 'FileUpdated';
      case 2:
        return 'FileDeleted';
      case 5:
        return 'FolderCreated';
      case 7:
        return 'FolderDeleted';
      default:
        return `Unknown(${type})`;
    }
  }
}
