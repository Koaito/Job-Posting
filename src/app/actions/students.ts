'use server';

/**
 * Server Actions for Students
 * Corresponds to Flask blueprint: blueprints/students.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function getStudents(filters?: any) {
  throw new Error('Not implemented');
}

export async function getStudentById(id: number) {
  throw new Error('Not implemented');
}
