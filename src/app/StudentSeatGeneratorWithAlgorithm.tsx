"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";

interface Student {
  id: string;
  name: string;
}

interface Seat {
  id: string;
  studentId: string | null;
  section: number;
  group: number;
}

interface Exception {
  type: "separate" | "together" | "same-group" | "different-group";
  studentIds: string[];
}

interface SeatHistory {
  date: string;
  arrangement: { [seatId: string]: string };
}

export default function StudentSeatGenerator() {
  const [students, setStudents] = useState<Student[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [seatHistory, setSeatHistory] = useState<SeatHistory[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(6);
  const [sections, setSections] = useState(3);
  const [exceptionType, setExceptionType] = useState<
    "separate" | "together" | "same-group" | "different-group"
  >("separate");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const newSeats: Seat[] = [];
    for (let i = 0; i < rows * columns; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const section = Math.floor(col / (columns / sections)) + 1;
      const group =
        Math.floor(row / 2) * (columns / 2) + Math.floor(col / 2) + 1;
      newSeats.push({ id: `seat-${i}`, studentId: null, section, group });
    }
    setSeats(newSeats);
  }, [rows, columns, sections]);

  const addStudent = () => {
    if (newStudentName.trim()) {
      setStudents([
        ...students,
        { id: `student-${Date.now()}`, name: newStudentName.trim() },
      ]);
      setNewStudentName("");
    }
  };

  const addException = () => {
    if (
      (exceptionType === "separate" || exceptionType === "together") &&
      selectedStudents.length === 2
    ) {
      setExceptions([
        ...exceptions,
        { type: exceptionType, studentIds: selectedStudents },
      ]);
      setSelectedStudents([]);
    } else if (
      (exceptionType === "same-group" || exceptionType === "different-group") &&
      selectedStudents.length >= 2 &&
      selectedStudents.length <= 4
    ) {
      setExceptions([
        ...exceptions,
        { type: exceptionType, studentIds: selectedStudents },
      ]);
      setSelectedStudents([]);
    } else {
      setErrorMessage("올바른 수의 학생을 선택해주세요.");
    }
  };

  const isAdjacent = (seat1: number, seat2: number) => {
    const row1 = Math.floor(seat1 / columns);
    const col1 = seat1 % columns;
    const section1 = Math.floor(col1 / (columns / sections));
    const group1 = Math.floor(row1 / 2) * (columns / 2) + Math.floor(col1 / 2);
    const row2 = Math.floor(seat2 / columns);
    const col2 = seat2 % columns;
    const section2 = Math.floor(col2 / (columns / sections));
    const group2 = Math.floor(row2 / 2) * (columns / 2) + Math.floor(col2 / 2);

    if (section1 !== section2) return false;
    if (group1 !== group2) return false;

    return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1;
  };

  const isSameGroup = (seat1: number, seat2: number) => {
    const row1 = Math.floor(seat1 / columns);
    const col1 = seat1 % columns;
    const row2 = Math.floor(seat2 / columns);
    const col2 = seat2 % columns;

    const group1 = Math.floor(row1 / 2) * (columns / 2) + Math.floor(col1 / 2);
    const group2 = Math.floor(row2 / 2) * (columns / 2) + Math.floor(col2 / 2);

    return group1 === group2;
  };

  const generateSeats = () => {
    setErrorMessage(null);
    const totalSeats = rows * columns;
    if (students.length > totalSeats) {
      setErrorMessage("학생 수가 좌석 수보다 많습니다.");
      return;
    }

    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
      attempts++;
      const newArrangement: { [seatId: string]: string } = {};
      const availableStudents = [...students];
      let success = true;

      // 먼저 '함께 앉아야 하는' 학생들을 배치
      for (const exception of exceptions.filter((e) => e.type === "together")) {
        const availableSeats = seats.filter((seat) => !newArrangement[seat.id]);
        const groupSeats = availableSeats.filter((_, index, array) =>
          exception.studentIds.every(
            (_, i) =>
              i === 0 ||
              isAdjacent(
                parseInt(array[index].id.split("-")[1]),
                parseInt(array[index - 1].id.split("-")[1])
              )
          )
        );

        if (groupSeats.length < exception.studentIds.length) {
          success = false;
          break;
        }

        exception.studentIds.forEach((studentId, index) => {
          newArrangement[groupSeats[index].id] = studentId;
          availableStudents.splice(
            availableStudents.findIndex((s) => s.id === studentId),
            1
          );
        });
      }

      if (!success) continue;

      // '같은 모둠에 앉아야 하는' 학생들을 배치
      for (const exception of exceptions.filter(
        (e) => e.type === "same-group"
      )) {
        const availableSeats = seats.filter((seat) => !newArrangement[seat.id]);
        const groupSeats = availableSeats.filter((_, index, array) =>
          exception.studentIds.every(
            (_, i) =>
              i === 0 ||
              isSameGroup(
                parseInt(array[index].id.split("-")[1]),
                parseInt(array[index - 1].id.split("-")[1])
              )
          )
        );

        if (groupSeats.length < exception.studentIds.length) {
          success = false;
          break;
        }

        exception.studentIds.forEach((studentId, index) => {
          newArrangement[groupSeats[index].id] = studentId;
          availableStudents.splice(
            availableStudents.findIndex((s) => s.id === studentId),
            1
          );
        });
      }

      if (!success) continue;

      // 나머지 학생들을 무작위로 배치
      for (const seat of seats) {
        if (!newArrangement[seat.id] && availableStudents.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * availableStudents.length
          );
          const student = availableStudents.splice(randomIndex, 1)[0];
          newArrangement[seat.id] = student.id;
        }
      }

      // '떨어져 앉아야 하는' 예외 사항 확인
      const separateExceptions = exceptions.filter(
        (e) => e.type === "separate"
      );
      let violatesSeparateException = false;
      for (const exception of separateExceptions) {
        const studentSeats = exception.studentIds
          .map(
            (studentId) =>
              Object.entries(newArrangement).find(
                ([, id]) => id === studentId
              )?.[0]
          )
          .filter(Boolean) as string[];

        for (let i = 0; i < studentSeats.length; i++) {
          for (let j = i + 1; j < studentSeats.length; j++) {
            if (
              isAdjacent(
                parseInt(studentSeats[i].split("-")[1]),
                parseInt(studentSeats[j].split("-")[1])
              )
            ) {
              violatesSeparateException = true;
              break;
            }
          }
          if (violatesSeparateException) break;
        }
        if (violatesSeparateException) break;
      }

      // '다른 모둠에 앉아야 하는' 예외 사항 확인
      const differentGroupExceptions = exceptions.filter(
        (e) => e.type === "different-group"
      );
      let violatesDifferentGroupException = false;
      for (const exception of differentGroupExceptions) {
        const studentSeats = exception.studentIds
          .map(
            (studentId) =>
              Object.entries(newArrangement).find(
                ([, id]) => id === studentId
              )?.[0]
          )
          .filter(Boolean) as string[];

        for (let i = 0; i < studentSeats.length; i++) {
          for (let j = i + 1; j < studentSeats.length; j++) {
            if (
              isSameGroup(
                parseInt(studentSeats[i].split("-")[1]),
                parseInt(studentSeats[j].split("-")[1])
              )
            ) {
              violatesDifferentGroupException = true;
              break;
            }
          }
          if (violatesDifferentGroupException) break;
        }
        if (violatesDifferentGroupException) break;
      }

      if (!violatesSeparateException && !violatesDifferentGroupException) {
        setSeatHistory([
          ...seatHistory,
          { date: new Date().toISOString(), arrangement: newArrangement },
        ]);
        setSeats(
          seats.map((seat) => ({
            ...seat,
            studentId: newArrangement[seat.id] || null,
          }))
        );
        return;
      }
    }

    setErrorMessage("조건을 만족하는 좌석 배치를 찾을 수 없습니다.");
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as {
          이름: string;
        }[];

        const newStudents: Student[] = jsonData.map((row, index) => ({
          id: `student-${Date.now()}-${index}`,
          name: row.이름,
        }));

        setStudents((prevStudents) => [...prevStudents, ...newStudents]);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">학생 좌석 생성기</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>학생 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="학생 이름 입력"
            />
            <Button onClick={addStudent}>추가</Button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button onClick={triggerFileUpload}>엑셀 파일 업로드</Button>
            <Label className="text-sm text-muted-foreground">
              엑셀 파일 업로드 (.xlsx, .xls)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>좌석 구조</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-2">
            <Label htmlFor="rows">행:</Label>
            <Input
              id="rows"
              type="number"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value))}
              min={1}
            />
            <Label htmlFor="columns">열:</Label>
            <Input
              id="columns"
              type="number"
              value={columns}
              onChange={(e) => setColumns(parseInt(e.target.value))}
              min={1}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="sections">분단 수:</Label>
            <Input
              id="sections"
              type="number"
              value={sections}
              onChange={(e) => setSections(parseInt(e.target.value))}
              min={1}
              max={columns}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>예외 사항</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Select
              value={exceptionType}
              onValueChange={(
                value:
                  | "separate"
                  | "together"
                  | "same-group"
                  | "different-group"
              ) => {
                setExceptionType(value);
                setSelectedStudents([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="예외 유형 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="separate">떨어져 앉아야 함</SelectItem>
                <SelectItem value="together">함께 앉아야 함</SelectItem>
                <SelectItem value="same-group">같은 모둠이어야 함</SelectItem>
                <SelectItem value="different-group">
                  다른 모둠이어야 함
                </SelectItem>
              </SelectContent>
            </Select>
            {(exceptionType === "separate" || exceptionType === "together") && (
              <>
                <Select
                  value={selectedStudents[0]}
                  onValueChange={(value) => setSelectedStudents([value])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="첫 번째 학생 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedStudents[1]}
                  onValueChange={(value) =>
                    setSelectedStudents((prev) => [...prev.slice(0, 1), value])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="두 번째 학생 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {students
                      .filter((s) => s.id !== selectedStudents[0])
                      .map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {(exceptionType === "same-group" ||
              exceptionType === "different-group") && (
              <>
                {[0, 1, 2, 3].map((index) => (
                  <Select
                    key={index}
                    value={selectedStudents[index]}
                    onValueChange={(value) => {
                      const newSelected = [...selectedStudents];
                      newSelected[index] = value;
                      setSelectedStudents(newSelected.filter(Boolean));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={`${index + 1}번째 학생 선택${
                          index < 2 ? "" : " (선택사항)"
                        }`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {students
                        .filter(
                          (s) =>
                            !selectedStudents.includes(s.id) ||
                            s.id === selectedStudents[index]
                        )
                        .map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ))}
              </>
            )}
            <Button onClick={addException}>예외 추가</Button>
          </div>
          {errorMessage && (
            <div className="text-red-500 mt-2">{errorMessage}</div>
          )}
          <div className="mt-4">
            <h3 className="font-semibold mb-2">현재 예외 사항:</h3>
            <ul className="list-disc pl-5">
              {exceptions.map((exception, index) => (
                <li key={index}>
                  {exception.type === "separate" && "떨어져 앉아야 함: "}
                  {exception.type === "together" && "함께 앉아야 함: "}
                  {exception.type === "same-group" && "같은 모둠이어야 함: "}
                  {exception.type === "different-group" &&
                    "다른 모둠이어야 함: "}
                  {exception.studentIds
                    .map((id) => students.find((s) => s.id === id)?.name)
                    .join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Button onClick={generateSeats} className="mb-4">
        좌석 생성
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>현재 좌석 배치</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <div className="text-red-500">{errorMessage}</div>
          ) : (
            <div className="flex space-x-4">
              {Array.from({ length: sections }, (_, sectionIndex) => (
                <div key={sectionIndex} className="flex-1">
                  <h3 className="text-center font-semibold mb-2">
                    {sectionIndex + 1}분단
                  </h3>
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${columns / sections}, 1fr)`,
                    }}
                  >
                    {seats
                      .filter((seat) => seat.section === sectionIndex + 1)
                      .map((seat) => {
                        const seatIndex = parseInt(seat.id.split("-")[1]);
                        const row = Math.floor(seatIndex / columns);
                        const col = seatIndex % columns;
                        const isEvenGroup =
                          (Math.floor(row / 2) + Math.floor(col / 2)) % 2 === 0;
                        return (
                          <div
                            key={seat.id}
                            className={`border p-2 text-center ${
                              isEvenGroup ? "bg-gray-100" : ""
                            }`}
                          >
                            {students.find((s) => s.id === seat.studentId)
                              ?.name || "빈 자리"}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
