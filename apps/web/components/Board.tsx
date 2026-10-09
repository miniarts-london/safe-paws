"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import { useRef, useState } from "react";
import { findStage, useBoard } from "@safe-paws/shared/store";
import { useNow } from "@safe-paws/shared/time";
import { useSend } from "@/lib/useBoardSocket";
import { STAGES, STAGE_IDS, type Columns, type StageId } from "@safe-paws/shared/protocol";
import { CardBody } from "./AnimalCard";
import { Column } from "./Column";

const isStage = (id: UniqueIdentifier): id is StageId => STAGE_IDS.includes(id as StageId);

export function Board() {
  const board = useBoard((s) => s.board)!;
  const users = useBoard((s) => s.users);
  const me = useBoard((s) => s.me);
  const setColumns = useBoard((s) => s.setColumns);
  const send = useSend();
  const now = useNow();

  const [activeId, setActiveId] = useState<string | null>(null);
  const before = useRef<Columns | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press-and-hold on phones, so swiping still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = () => useBoard.getState().board!.columns;

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    before.current = columns();
  };

  // Moving between columns happens live while dragging, so the gap opens where the card will land.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const cols = columns();
    const id = String(active.id);
    const from = findStage(cols, id);
    const to = isStage(over.id) ? over.id : findStage(cols, String(over.id));
    if (!from || !to || from === to) return;
    const target = cols[to].filter((x) => x !== id);
    const overIndex = isStage(over.id) ? target.length : target.indexOf(String(over.id));
    target.splice(overIndex < 0 ? target.length : overIndex, 0, id);
    setColumns({ ...cols, [from]: cols[from].filter((x) => x !== id), [to]: target });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const id = String(active.id);
    const cols = columns();
    const stage = findStage(cols, id);
    if (!over || !stage) return revert();

    let items = cols[stage];
    if (!isStage(over.id) && findStage(cols, String(over.id)) === stage) {
      const from = items.indexOf(id);
      const to = items.indexOf(String(over.id));
      if (from !== to) {
        items = arrayMove(items, from, to);
        setColumns({ ...cols, [stage]: items });
      }
    }

    const index = items.indexOf(id);
    const start = before.current;
    const unchanged = start && findStage(start, id) === stage && start[stage].indexOf(id) === index;
    if (unchanged) return;
    if (!send({ type: "animal.move", animalId: id, toStage: stage, toIndex: index })) revert();
  };

  const revert = () => {
    if (before.current) setColumns(before.current);
    setActiveId(null);
  };

  const active = activeId ? board.animals[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={revert}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${board.animals[String(active.id)]?.name}.`,
          onDragOver: ({ active, over }) => {
            const stage = over && (isStage(over.id) ? over.id : findStage(columns(), String(over.id)));
            return stage ? `${board.animals[String(active.id)]?.name} is over ${STAGES.find((s) => s.id === stage)?.label}.` : "";
          },
          onDragEnd: ({ active, over }) => {
            const stage = over && findStage(columns(), String(active.id));
            return stage ? `${board.animals[String(active.id)]?.name} moved to ${STAGES.find((s) => s.id === stage)?.label}.` : "Move cancelled.";
          },
          onDragCancel: () => "Move cancelled.",
        },
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(250px, 1fr)",
          gap: 1.5,
          px: 2.5,
          pt: 1.75,
          pb: 3,
          overflowX: "auto",
        }}
      >
        {STAGES.map((stage) => (
          <Column key={stage.id} stage={stage} ids={board.columns[stage.id]} animals={board.animals} users={users} me={me} now={now} />
        ))}
      </Box>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {active && (
          <Card sx={{ p: 1.5, cursor: "grabbing", transform: "rotate(1.5deg)", boxShadow: 8 }}>
            <CardBody animal={active} users={users} me={me} now={now} />
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
