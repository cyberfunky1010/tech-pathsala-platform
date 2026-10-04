import { NextResponse } from "next/server";

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function apiData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
