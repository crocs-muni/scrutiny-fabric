// Re-export all error types from the centralized types module.
// Kept as a separate barrel for backward compatibility; all definitions live in types/.
export {
  ErrorCode,
  type ScrutinyError,
  type ScrutinyIssue,
  issue,
} from '../types/index.js';
