import QuestionManagement from "@/components/question-management";

export default async function TestQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  return <QuestionManagement testId={(await params).id} />;
}
