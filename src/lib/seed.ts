/**
 * Seed Script for Classroom App
 * 
 * This script creates:
 * - 1 admin account
 * - 3 teacher accounts
 * - 5 student accounts
 * - 2 departments
 * - 6 subjects
 * 
 * Note: Organization creation is skipped - users can create org via UI
 * 
 * Run with: npx tsx src/lib/seed.ts
 */

import { auth } from "./auth.js";
import { db } from "../db/index.js";
import { departments, subjects, user } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

// Seed data constants
const SEED_DATA = {
    admin: { 
        name: "Admin", 
        email: "admin@school.com", 
        password: "AdminPass123" 
    },
    teachers: [
        { name: "John Smith", email: "teacher1@school.com", password: "TeacherPass123" },
        { name: "Jane Doe", email: "teacher2@school.com", password: "TeacherPass123" },
        { name: "Mr. Johnson", email: "teacher3@school.com", password: "TeacherPass123" },
    ],
    students: [
        { name: "Alice Brown", email: "student1@school.com", password: "StudentPass123" },
        { name: "Bob Wilson", email: "student2@school.com", password: "StudentPass123" },
        { name: "Charlie Lee", email: "student3@school.com", password: "StudentPass123" },
        { name: "Diana Garcia", email: "student4@school.com", password: "StudentPass123" },
        { name: "Evan Martinez", email: "student5@school.com", password: "StudentPass123" },
    ],
    departments: [
        { code: "SCI", name: "Science", description: "Science department" },
        { code: "ARTS", name: "Arts", description: "Arts and Humanities department" },
    ],
    subjects: [
        { code: "MATH", name: "Mathematics", description: "Math course", deptCode: "SCI" },
        { code: "PHYS", name: "Physics", description: "Physics course", deptCode: "SCI" },
        { code: "CHEM", name: "Chemistry", description: "Chemistry course", deptCode: "SCI" },
        { code: "HIST", name: "History", description: "History course", deptCode: "ARTS" },
        { code: "ENG", name: "English", description: "English course", deptCode: "ARTS" },
        { code: "ART", name: "Art", description: "Art course", deptCode: "ARTS" },
    ],
};

/**
 * Check if seed has already been run
 * We check by looking for the admin user
 */
async function isAlreadySeeded(): Promise<boolean> {
    const existingAdmin = await db
        .select()
        .from(user)
        .where(eq(user.email, SEED_DATA.admin.email))
        .limit(1);
    return existingAdmin.length > 0;
}

/**
 * Create a user via better-auth API
 */
async function createUser(
    email: string, 
    name: string, 
    password: string, 
    role: "admin" | "teacher" | "student"
): Promise<{ id: string }> {
    try {
        const authApi = auth.api as any;
        const result = await authApi.signUpEmail({
            body: {
                email,
                password,
                name,
                role,
            },
        });
        
        if (!result?.user) {
            throw new Error(`Failed to create user: ${email}`);
        }
        
        console.log(`✓ Created user: ${email} (role: ${role})`);
        return { id: result.user.id };
    } catch (error: any) {
        // If user already exists, try to get their ID
        if (error.message?.includes("already exists") || error.status === 400) {
            console.log(`⚠ User already exists: ${email}`);
            const existingUser = await db
                .select()
                .from(user)
                .where(eq(user.email, email))
                .limit(1);
            if (existingUser.length > 0) {
                return { id: existingUser[0].id };
            }
        }
        throw error;
    }
}

/**
 * Create department
 */
async function createDepartment(
    code: string, 
    name: string, 
    description?: string
): Promise<{ id: number }> {
    // Check if exists
    const existing = await db
        .select()
        .from(departments)
        .where(eq(departments.code, code))
        .limit(1);
    
    if (existing.length > 0) {
        console.log(`⚠ Department already exists: ${code}`);
        return { id: existing[0].id };
    }
    
    const [dept] = await db
        .insert(departments)
        .values({ code, name, description })
        .returning({ id: departments.id });
    
    if (!dept) {
        throw new Error(`Failed to create department: ${name}`);
    }
    
    console.log(`✓ Created department: ${name} (${code})`);
    return { id: dept.id };
}

/**
 * Create subject
 */
async function createSubject(
    code: string, 
    name: string, 
    departmentId: number,
    description?: string
): Promise<{ id: number }> {
    // Check if exists
    const existing = await db
        .select()
        .from(subjects)
        .where(eq(subjects.code, code))
        .limit(1);
    
    if (existing.length > 0) {
        console.log(`⚠ Subject already exists: ${code}`);
        return { id: existing[0].id };
    }
    
    const [subject] = await db
        .insert(subjects)
        .values({ code, name, departmentId, description })
        .returning({ id: subjects.id });
    
    if (!subject) {
        throw new Error(`Failed to create subject: ${name}`);
    }
    
    console.log(`✓ Created subject: ${name} (${code})`);
    return { id: subject.id };
}

/**
 * Main seed function
 */
export async function seed(): Promise<void> {
    console.log("=== Starting Seed ===\n");
    console.log("Note: Organization creation skipped - create via UI after login\n");
    
    // Check if already seeded
    const alreadySeeded = await isAlreadySeeded();
    if (alreadySeeded) {
        console.log("⚠ Seed has already been run. Skipping...");
        return;
    }
    
    try {
        // Step 1: Create admin user
        console.log("--- Step 1: Creating Admin ---");
        await createUser(
            SEED_DATA.admin.email,
            SEED_DATA.admin.name,
            SEED_DATA.admin.password,
            "admin"
        );
        
        // Step 2: Create teachers
        console.log("\n--- Step 2: Creating Teachers ---");
        for (const t of SEED_DATA.teachers) {
            await createUser(t.email, t.name, t.password, "teacher");
        }
        
        // Step 3: Create students
        console.log("\n--- Step 3: Creating Students ---");
        for (const s of SEED_DATA.students) {
            await createUser(s.email, s.name, s.password, "student");
        }
        
        // Step 4: Create departments
        console.log("\n--- Step 4: Creating Departments ---");
        const deptMap: Record<string, number> = {};
        for (const d of SEED_DATA.departments) {
            const dept = await createDepartment(d.code, d.name, d.description);
            deptMap[d.code] = dept.id;
        }
        
        // Step 5: Create subjects
        console.log("\n--- Step 5: Creating Subjects ---");
        for (const s of SEED_DATA.subjects) {
            const deptId = deptMap[s.deptCode];
            if (!deptId) {
                throw new Error(`Department not found: ${s.deptCode}`);
            }
            await createSubject(s.code, s.name, deptId, s.description);
        }
        
        console.log("\n=== Seed Complete! ===");
        console.log("\nLogin credentials:");
        console.log(`Admin: ${SEED_DATA.admin.email} / ${SEED_DATA.admin.password}`);
        console.log(`Teacher 1: ${SEED_DATA.teachers[0]?.email ?? ''} / ${SEED_DATA.teachers[0]?.password ?? ''}`);
        console.log(`Teacher 2: ${SEED_DATA.teachers[1]?.email ?? ''} / ${SEED_DATA.teachers[1]?.password ?? ''}`);
        console.log(`Teacher 3: ${SEED_DATA.teachers[2]?.email ?? ''} / ${SEED_DATA.teachers[2]?.password ?? ''}`);
        console.log(`Student 1: ${SEED_DATA.students[0]?.email ?? ''} / ${SEED_DATA.students[0]?.password ?? ''}`);
        console.log(`Student 2: ${SEED_DATA.students[1]?.email ?? ''} / ${SEED_DATA.students[1]?.password ?? ''}`);
        console.log(`Student 3: ${SEED_DATA.students[2]?.email ?? ''} / ${SEED_DATA.students[2]?.password ?? ''}`);
        console.log(`Student 4: ${SEED_DATA.students[3]?.email ?? ''} / ${SEED_DATA.students[3]?.password ?? ''}`);
        console.log(`Student 5: ${SEED_DATA.students[4]?.email ?? ''} / ${SEED_DATA.students[4]?.password ?? ''}`);
        console.log("\n⚠ Important: After logging in, create an organization in the UI to enable RBAC features.");
        
    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        throw error;
    }
}

// Run if called directly
seed().catch(console.error);
