"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import CloseIcon from "@mui/icons-material/Close";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ROLE_LABELS, STAFF_ROLES, type Member } from "@safe-paws/shared/protocol";
import { approveSchema, TITLE_MAX, type ApproveInput } from "@safe-paws/shared/schemas";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { useSend } from "@/lib/useBoardSocket";

/** Coordinators only: the header button, with a badge for people waiting to be reviewed. */
export function MembersButton() {
  const waiting = useBoard((s) => s.members.filter((m) => m.reviewedAt === null).length);
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        aria-label={waiting ? `Members, ${waiting} waiting for review` : "Members"}
        aria-haspopup="dialog"
      >
        <Badge badgeContent={waiting} color="primary" max={9}>
          <GroupOutlined />
        </Badge>
      </IconButton>
      <MembersDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MembersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const members = useBoard((s) => s.members);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const waiting = members.filter((m) => m.reviewedAt === null);
  const kept = members.filter((m) => m.reviewedAt !== null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Approving someone removes their row, taking keyboard focus with it. Bring focus
  // back into the dialog so Tab and Escape keep working.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (!active || active === document.body) titleRef.current?.focus();
  }, [open, members]);

  return (
    <Dialog open={open} onClose={onClose} fullScreen={mobile} fullWidth maxWidth="sm" aria-labelledby="members-title">
      <DialogTitle id="members-title" ref={titleRef} tabIndex={-1} sx={{ pr: 7, "&:focus": { outline: "none" } }}>
        Members
        <Typography variant="body2" color="text.secondary">
          Anyone can sign up and see the board. Make volunteers staff so they can update it.
        </Typography>
      </DialogTitle>
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: "absolute", right: 12, top: 12 }}>
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Section title={`Waiting for review${waiting.length ? ` (${waiting.length})` : ""}`}>
            {waiting.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nobody new. When someone signs up, they&apos;ll appear here.
              </Typography>
            ) : (
              waiting.map((m) => <MemberRow key={m.id} member={m} />)
            )}
          </Section>
          {kept.length > 0 && (
            <Section title="Kept as members (last 30 days)">
              {kept.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </Section>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1.5} component="section">
      <Typography variant="overline" color="text.secondary" component="h3">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

const ROLE_HINT: Record<ApproveInput["role"], string> = {
  coordinator: "Runs the rescue; reviews new members",
  vet: "Hears when animals need a check",
  fosterer: "Hears when an animal needs a place to recover",
  sponsor: "Supports animals and follows their progress",
};

function MemberRow({ member }: { member: Member }) {
  const send = useSend();
  const now = useNow();
  const { control, handleSubmit } = useForm<ApproveInput>({
    resolver: zodResolver(approveSchema),
    defaultValues: { userId: member.id, role: "fosterer", title: member.title === "New member" ? "" : member.title },
    mode: "onSubmit",
  });
  const approve = handleSubmit((values) => send({ type: "member.approve", ...values }));

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ fontWeight: 650 }}>{member.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {member.email} · joined {timeAgo(member.joinedAt, now)}
          </Typography>
          {member.title !== "New member" && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              “{member.title}”
            </Typography>
          )}
        </Box>
        <Box component="form" noValidate onSubmit={approve}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Controller
              name="role"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  id={`role-${member.id}`}
                  label="Role"
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? ROLE_HINT[field.value]}
                  sx={{ minWidth: { sm: 170 } }}
                >
                  {STAFF_ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  id={`title-${member.id}`}
                  label="Shown under their name"
                  placeholder="e.g. Foster carer, Smouha"
                  size="small"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ htmlInput: { maxLength: TITLE_MAX } }}
                />
              )}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 1.5 }}>
            {member.reviewedAt === null && (
              <Button color="inherit" onClick={() => send({ type: "member.keep", userId: member.id })}>
                Keep as member
              </Button>
            )}
            <Button type="submit" variant="contained">
              Make staff
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
