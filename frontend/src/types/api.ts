// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserRole = 'ADMIN' | 'MANAGER' | 'ENGINEER';
export type SoftwareAccess = 'INSTALLATION' | 'IMPLEMENTATION' | 'BOTH';
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
export type ImplementationStatus = 'InProgress' | 'OnHold' | 'Live' | 'Completed' | 'Blocked';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: number;
  name: string;
  role: UserRole;
  software_access: SoftwareAccess;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  name: string;
  role: UserRole;
  software_access: SoftwareAccess;
  timezone: string;
}

export interface UserCreate {
  name: string;
  role: UserRole;
  software_access: SoftwareAccess;
  password: string;
  timezone: string;
}

export interface UserUpdate {
  name?: string;
  role?: UserRole;
  software_access?: SoftwareAccess;
  password?: string;
  timezone?: string;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface Client {
  id: number;
  name: string;
  contact_info: string | null;
  database_type: string | null;
  database_version: string | null;
  remarks: string | null;
  tags: string | null;
}

export interface ClientCreate {
  name: string;
  database_type?: string | null;
  database_version?: string | null;
  remarks?: string | null;
  tags?: string | null;
}

export interface ClientUpdate extends Partial<ClientCreate> {}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export interface Location {
  id: number;
  client_id: number;
  name: string;
  address: string | null;
  hostname: string | null;
}

export interface LocationCreate {
  name: string;
  client_id: number;
  hostname?: string;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface Task {
  id: number;
  location_id: number;
  name: string;
  build_version: string | null;
  remarks: string | null;
  status: TaskStatus;
  assigned_to: number | null;
  due_date: string;
  dependency_task_id: number | null;
}

export interface TaskCreate {
  name: string;
  location_id: number;
  due_date: string;
  build_version?: string | null;
  remarks?: string | null;
  dependency_task_id?: number | null;
}

export interface TaskUpdate {
  name?: string;
  due_date?: string;
  build_version?: string | null;
  remarks?: string | null;
}

export interface TaskStatusUpdate {
  status: TaskStatus;
}

export interface TaskAssign {
  assigned_to: number | null;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface Comment {
  id: number;
  task_id: number;
  user_id: number | null;
  content: string;
  parent_id: number | null;
  timestamp: string;
  user: User | null;
  replies: Comment[];
}

export interface CommentCreate {
  task_id: number;
  content: string;
  parent_id?: number | null;
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

export interface ImplementationTask {
  id: number;
  implementation_id: number;
  task_name: string;
  section_name: string | null;
  weight: number;
  is_completed: boolean;
  is_active: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface ImplementationLog {
  id: number;
  implementation_id: number;
  user_id: number | null;
  date: string;
  remarks: string;
  percentage_at_time: number | null;
  milestone_stage: string | null;
  created_at: string;
  user_name: string | null;
}

export interface Implementation {
  id: number;
  company_name: string;
  zone: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  po_date: string | null;
  poc_1: string | null;
  poc_2: string | null;
  license_uat: string | null;
  license_prod: string | null;
  uat_version: string | null;
  prod_version: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  status: ImplementationStatus;
  status_remarks: string | null;
  current_percentage: number;
  created_at: string;
}

export interface ImplementationDetail extends Implementation {
  logs: ImplementationLog[];
  tasks: ImplementationTask[];
}

export interface ImplementationCreate {
  company_name: string;
  zone?: string | null;
  assigned_user_id?: number | null;
  po_date?: string | null;
  poc_1?: string | null;
  poc_2?: string | null;
  license_uat?: string | null;
  license_prod?: string | null;
  uat_version?: string | null;
  prod_version?: string | null;
  start_date?: string | null;
  expected_end_date?: string | null;
  status?: ImplementationStatus;
  status_remarks?: string | null;
}

export interface ImplementationUpdate extends Partial<ImplementationCreate> {}

// ---------------------------------------------------------------------------
// Milestone Templates
// ---------------------------------------------------------------------------

export interface GlobalMilestone {
  id: number;
  task_name: string;
  weight: number;
  order: number;
  section_id: number | null;
}

export interface MilestoneSection {
  id: number;
  name: string;
  weight: number;
  order: number;
  milestones: GlobalMilestone[];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  total_clients: number;
  total_locations: number;
  total_tasks: number;
  completed_tasks: number;
  delayed_tasks: number;
  overall_progress: number;
  total_implementations: number;
  live_implementations: number;
  stagnant_implementations: number;
  implementations_by_status: Record<string, number>;
  live_implementation_details: string[];
  stagnant_implementation_details: string[];
  delayed_task_details: string[];
  in_progress_implementation_details: string[];
}

export interface DelayedTaskDetail {
  task: Task;
  location: Location;
  client: Client;
  days_delayed: number;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface ChatRequest {
  query: string;
  summary_type: 'implementation' | 'installation';
  client_id?: number | null;
  history?: ChatMessage[];
}

// ---------------------------------------------------------------------------
// API error shape (matches backend)
// ---------------------------------------------------------------------------

export interface ApiError {
  status_code: number;
  message: string;
  detail?: unknown;
}
