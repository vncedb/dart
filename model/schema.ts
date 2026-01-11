import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'attendance',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'clock_in', type: 'string' },
        { name: 'clock_out', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'remarks', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'accomplishments',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'description', type: 'string' },
        { name: 'remarks', type: 'string', isOptional: true },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'profiles',
      columns: [
        { name: 'email', type: 'string', isOptional: true },
        { name: 'first_name', type: 'string', isOptional: true },
        { name: 'last_name', type: 'string', isOptional: true },
        { name: 'middle_name', type: 'string', isOptional: true },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'professional_suffix', type: 'string', isOptional: true },
        { name: 'current_job_id', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'job_positions',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'company', type: 'string', isOptional: true },
        { name: 'department', type: 'string', isOptional: true },
        { name: 'employment_status', type: 'string', isOptional: true },
        { name: 'rate', type: 'number' },
        { name: 'rate_type', type: 'string' },
        { name: 'work_schedule', type: 'string' }, // Stored as JSON string
        { name: 'break_schedule', type: 'string' }, // Stored as JSON string
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'app_settings',
      columns: [
        { name: 'key', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' },
      ]
    }),
  ]
})