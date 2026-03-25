# DocGit Architecture Diagrams

This document contains visual diagrams reflecting the architecture of the **DocGit** project, based on the requirements and structures outlined in `project_architecture.md`. All diagrams are generated using Mermaid.js syntax.

## 1. Entity Relationship Diagram (ERD)

This ERD displays the database schema utilizing SQLite via Entity Framework Core. It shows the relationship between users, file-system entities, and file histories.

```mermaid
erDiagram
    Users ||--o{ FileSystemEntities : "owns (UserId)"
    FileSystemEntities ||--o{ FileSystemEntities : "contains (ParentId)"
    FileSystemEntities ||--o{ FileHistories : "has versions (FileEntityId)"

    Users {
        int Id PK
        string Username
        string PasswordHash
        datetime CreatedAt
    }

    FileSystemEntities {
        int Id PK
        int UserId FK
        int ParentId FK
        string Name
        string Path
        boolean IsFile
        byte[] Content
        string Extension
        long Bytes
        boolean IsDeleted
        datetime DeletedAt
        datetime CreatedAt
        datetime ChangedAt
    }

    FileHistories {
        int Id PK
        int FileEntityId FK
        int VersionNumber
        byte[] Content
        long Bytes
        datetime SavedAt
    }
```

## 2. Data Flow Diagram (DFD)

This DFD outlines how data moves between the User (Client App), the various server processing units, and the backend data stores.

```mermaid
flowchart TD
    Client([User / Angular UI Web Client])

    subgraph ASP.NET Web API Backend
        AuthProc((Authentication\nProcess))
        FileProc((File Management\nProcess))
        HistoryProc((History & Recovery\nProcess))
        SignalRProc((SignalR Event\nHub Process))
    end

    subgraph SQLite Database
        UserDB[(Users DB)]
        FileDB[(FileSystemEntities DB)]
        HistoryDB[(FileHistories DB)]
    end

    %% Auth Flow
    Client -- "Credentials" --> AuthProc
    AuthProc -- "Validate login" --> UserDB
    AuthProc -- "JWT Token" --> Client

    %% File Management Flow
    Client -- "CRUD + JWT /api/files" --> FileProc
    FileProc -- "Query/Update" --> FileDB

    %% History Flow
    Client -- "History/Restore + JWT" --> HistoryProc
    HistoryProc -- "Query/Save versions" --> HistoryDB
    HistoryProc -- "Trigger recovery" --> FileProc

    %% SignalR Flow
    FileProc -- "Broadcast on mutation" --> SignalRProc
    HistoryProc -- "Broadcast on restore" --> SignalRProc
    SignalRProc -- "Real-time WS Event" -.-> Client
```

## 3. Component Diagram

This diagram displays the structural layout of the application frontend components, backend controllers/services, and how they connect.

```mermaid
flowchart TB
    subgraph Frontend [Angular Single Page Application]
        UI[Angular UI Components\nSidebar, Editor, Login]
        AS[AuthService]
        FS[FileService]
        SRS[SignalRService]
        
        UI --> AS
        UI --> FS
        UI --> SRS
    end

    subgraph Backend [ASP.NET Core Web API]
        AC[AuthController]
        FC[FilesController]
        EH[EventHub SignalR]
        
        JS[JwtService]
        BackendFS[FileService]
        FHS[FileHistoryService]
        
        AC --> JS
        FC --> BackendFS
        FC --> FHS
        BackendFS --> EH
        BackendFS --> FHS
    end

    subgraph Data [Entity Framework + SQLite]
        DbContext[AppDbContext]
    end

    %% Network communication
    AS -- "POST /api/login" --> AC
    FS -- "REST /api/files/*" --> FC
    SRS <== "WebSocket /api/events/signalr" ==> EH

    %% DB Interaction
    JS --> DbContext
    BackendFS --> DbContext
    FHS --> DbContext
```

## 4. Class Diagram

This class diagram represents the core Object-Oriented structure of the Backend models, services, and controllers.

```mermaid
classDiagram
    class User {
        +int Id
        +string Username
        +string PasswordHash
        +DateTime CreatedAt
    }

    class FileSystemEntity {
        +int Id
        +int UserId
        +string Name
        +string Path
        +bool IsFile
        +byte[] Content
        +string Extension
        +long Bytes
        +int? ParentId
        +bool IsDeleted
        +DateTime? DeletedAt
        +DateTime CreatedAt
        +DateTime ChangedAt
    }

    class FileHistory {
        +int Id
        +int FileEntityId
        +int VersionNumber
        +byte[] Content
        +long Bytes
        +DateTime SavedAt
    }

    User "1" -- "*" FileSystemEntity : owns
    FileSystemEntity "1" -- "*" FileSystemEntity : parent of
    FileSystemEntity "1" -- "*" FileHistory : has

    class AuthController {
        +Login(LoginRequestDto) LoginResponseDto
    }

    class FilesController {
        +GetFiles()
        +GetFileContent(path)
        +CreateFile(path, fileContent)
        +UpdateFile(path, fileContent)
        +DeleteFile(path)
        +GetFileHistory(path)
        +RestoreHistory(path, version)
        +GetTrash()
    }

    class EventHub {
        +SendAsync(eventMethod, eventType, filePath)
    }

    class FileService {
        +GetAllForUser(userId)
        +GetByPath(userId, path)
        +Create(userId, path, content)
        +Update(userId, path, content)
        +SoftDelete(userId, path)
    }

    class FileHistoryService {
        +SaveVersion(fileEntity)
        +GetHistoryList(fileEntityId)
        +GetVersionContent(fileEntityId, version)
    }

    class JwtService {
        +Authenticate(username, password)
        +GenerateToken(user)
    }

    FilesController --> FileService : delegates to
    FilesController --> FileHistoryService : delegates to
    FilesController --> EventHub : triggers events
    AuthController --> JwtService : uses

    FileService --> FileSystemEntity : manages
    FileHistoryService --> FileHistory : manages
    JwtService --> User : fetches
```
