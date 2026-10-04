import StudentTestAttempt from "@/components/student-test-attempt";

export default async function StudentTestAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  return <StudentTestAttempt testId={(await params).id} />;
}
