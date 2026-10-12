"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Animal } from "@safe-paws/shared/protocol";
import { ABOUT_MAX, animalDetailsSchema, type AnimalDetailsForm } from "@safe-paws/shared/schemas";
import { useBoard, useIsCoordinator } from "@safe-paws/shared/store";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Control, type FieldPath } from "react-hook-form";
import { useAnimalForm } from "@/lib/formStore";
import { useSend } from "@/lib/useBoardSocket";
import { MediaPicker } from "./../../MediaPicker";

/** Neighbourhoods offered as suggestions; anything else can still be typed. */
const ALEXANDRIA_AREAS = [
  "Agami", "Gleem", "Miami", "Montaza", "Raml Station", "Sidi Bishr", "Sidi Gaber",
  "Smouha", "Sporting", "Stanley", "Camp Caesar", "Mandara", "Louran", "Bolkly",
];

const EMPTY: AnimalDetailsForm = {
  name: "",
  species: "dog",
  sex: "female",
  age: { value: NaN, unit: "years", estimated: true },
  neutered: "unknown",
  weightKg: null,
  area: "",
  about: "",
  media: [],
};

function fromAnimal(a: Animal): AnimalDetailsForm {
  return {
    name: a.name,
    species: a.species,
    sex: a.sex,
    age: { ...a.age },
    neutered: a.neutered,
    weightKg: a.weightKg,
    area: a.area,
    about: a.about,
    media: a.media.map(({ id, kind, name }) => ({ id, kind, name })),
  };
}

/** Opens for "Register an animal" and for "Edit details"; one form, two modes. */
export function AnimalFormDialog() {
  const form = useAnimalForm((s) => s.form);
  const animal = useBoard((s) => (form?.mode === "edit" ? s.board?.animals[form.animalId] : undefined));
  const close = useAnimalForm((s) => s.close);
  const fullScreen = useMediaQuery((t) => t.breakpoints.down("sm"));
  const open = !!form && (form.mode === "create" || !!animal);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : close());
  const notice = useAnimalForm((s) => s.notice);
  const clearNotice = () => useAnimalForm.getState().setNotice(null);

  return (
    <>
      <Snackbar
        open={!!notice}
        autoHideDuration={5000}
        onClose={clearNotice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={clearNotice}>
          {notice}
        </Alert>
      </Snackbar>
      <Dialog
        open={open}
        onClose={requestClose}
        fullScreen={fullScreen}
        maxWidth="sm"
        fullWidth
        aria-labelledby="animal-form-title"
        slotProps={{ transition: { onExited: () => setDirty(false) } }}
      >
        {open && (
          <AnimalForm
            // Fresh form state each time it opens, and per animal when editing.
            key={form?.mode === "edit" ? form.animalId : "new"}
            animal={animal}
            onDirtyChange={setDirty}
            onCancel={requestClose}
            onDone={close}
          />
        )}
        <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} aria-labelledby="discard-title">
          <DialogTitle id="discard-title">Discard your changes?</DialogTitle>
          <DialogContent>
            <Typography>What you&apos;ve entered in this form will be lost.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button
              color="error"
              onClick={() => {
                setConfirmDiscard(false);
                close();
              }}
            >
              Discard
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </>
  );
}

type FormProps = {
  animal?: Animal;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
};

function AnimalForm({ animal, onDirtyChange, onCancel, onDone }: FormProps) {
  const send = useSend();
  // Select the stable animals object; building the list inside the selector would make a
  // new array every render, which Zustand treats as a change (an infinite render loop).
  const animals = useBoard((s) => s.board?.animals);
  const areas = useMemo(
    () => [...new Set([...ALEXANDRIA_AREAS, ...Object.values(animals ?? {}).map((a) => a.area)])].sort(),
    [animals],
  );
  const [uploading, setUploading] = useState(0);
  const canDelete = useIsCoordinator() && !!animal;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const onBusyChange = useCallback((n: number) => setUploading(n), []);

  const { control, handleSubmit, formState, setError } = useForm<AnimalDetailsForm>({
    resolver: zodResolver(animalDetailsSchema),
    defaultValues: animal ? fromAnimal(animal) : EMPTY,
    // Quiet until the first Save/Register press, then errors update as you fix them.
    // (onTouched would flag Name the moment the dialog takes focus.)
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const name = useWatch({ control, name: "name" });

  // Report dirtiness up so closing can ask before throwing work away.
  const isDirty = formState.isDirty;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const submit = handleSubmit((details) => {
    if (uploading > 0) {
      setError("root", { message: "Wait for the uploads to finish, then save." });
      return;
    }
    if (animal) {
      if (send({ type: "animal.update", animalId: animal.id, details })) onDone();
      return;
    }
    const animalId = crypto.randomUUID();
    if (send({ type: "animal.create", animalId, details })) {
      onDone();
      // Confirm once the board has it (it appears at the top of Reported). The panel stays closed.
      const unsub = useBoard.subscribe((s) => {
        if (s.board?.animals[animalId]) {
          unsub();
          useAnimalForm.getState().setNotice(`${details.name} is on the board, at the top of Reported.`);
        }
      });
      setTimeout(unsub, 5000);
    }
  });

  const remove = () => {
    if (!animal || !send({ type: "animal.delete", animalId: animal.id })) return;
    setConfirmDelete(false);
    onDone();
    // Confirm once the server has removed it; if it refuses, the board's error message shows instead.
    const unsub = useBoard.subscribe((s) => {
      if (s.board && !s.board.animals[animal.id]) {
        unsub();
        useAnimalForm.getState().setNotice(`${animal.name} was deleted.`);
      }
    });
    setTimeout(unsub, 5000);
  };

  const title = animal ? `Edit ${animal.name}'s details` : "Register an animal";
  const err = formState.errors;

  return (
    <Box component="form" noValidate onSubmit={submit} sx={{ display: "contents" }}>
      <DialogTitle id="animal-form-title">{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="animal-name"
                label="Name"
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? "What the rescue calls them. You can change it later."}
              />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Choice
              control={control}
              name="species"
              label="Species"
              options={[
                ["dog", "Dog"],
                ["cat", "Cat"],
              ]}
            />
            <Choice
              control={control}
              name="sex"
              label="Sex"
              options={[
                ["female", "Female"],
                ["male", "Male"],
              ]}
            />
          </Stack>

          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Controller
                name="age.value"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    id="animal-age"
                    label="Age"
                    required
                    type="number"
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(e) => field.onChange(e.target.value === "" ? NaN : Number(e.target.value))}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { min: 0, step: "any", inputMode: "decimal" } }}
                    sx={{ flex: 1 }}
                  />
                )}
              />
              <Controller
                name="age.unit"
                control={control}
                render={({ field }) => (
                  <TextField {...field} id="animal-age-unit" select label="Unit" sx={{ width: 140 }}>
                    <MenuItem value="weeks">Weeks</MenuItem>
                    <MenuItem value="months">Months</MenuItem>
                    <MenuItem value="years">Years</MenuItem>
                  </TextField>
                )}
              />
            </Stack>
            <Controller
              name="age.estimated"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} id="animal-age-est" />}
                  label="This is an estimate"
                />
              )}
            />
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { sm: "flex-start" } }}>
            <Choice
              control={control}
              name="neutered"
              label="Neutered / spayed"
              options={[
                ["yes", "Yes"],
                ["no", "No"],
                ["unknown", "Not sure"],
              ]}
            />
            <Controller
              name="weightKg"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  id="animal-weight"
                  label="Weight"
                  type="number"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? "Leave blank if they haven't been weighed yet."}
                  slotProps={{
                    input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> },
                    htmlInput: { min: 0, step: 0.1, inputMode: "decimal" },
                  }}
                  sx={{ flex: 1 }}
                />
              )}
            />
          </Stack>

          <Controller
            name="area"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                // The id goes here: Autocomplete gives it to the input and links the label to it.
                id="animal-area"
                freeSolo
                options={areas}
                value={field.value}
                onChange={(_, v) => field.onChange(v ?? "")}
                onInputChange={(_, v) => field.onChange(v)}
                onBlur={field.onBlur}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={field.ref}
                    label="Found in"
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? "The neighbourhood where they were found."}
                  />
                )}
              />
            )}
          />

          <Controller
            name="about"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                id="animal-about"
                label="Notes"
                multiline
                minRows={3}
                placeholder="Temperament, health, injuries, what they need. Dated news goes in Updates."
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? `${field.value.length} / ${ABOUT_MAX}`}
              />
            )}
          />

          <Section label="Photos and videos">
            <Controller
              name="media"
              control={control}
              render={({ field, fieldState }) => (
                <MediaPicker value={field.value} onChange={field.onChange} onBusyChange={onBusyChange} error={fieldState.error?.message} />
              )}
            />
          </Section>

          {err.root && <Alert severity="warning">{err.root.message}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {canDelete && (
          <Button
            color="error"
            startIcon={<DeleteOutlined />}
            onClick={() => setConfirmDelete(true)}
            sx={{ mr: "auto" }}
          >
            Delete
          </Button>
        )}
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={uploading > 0}>
          {uploading > 0
            ? `Uploading ${uploading}…`
            : animal
              ? "Save changes"
              : name.trim()
                ? `Register ${name.trim()}`
                : "Register"}
        </Button>
      </DialogActions>

      {animal && (
        <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} aria-labelledby="delete-title" aria-describedby="delete-text">
          <DialogTitle id="delete-title">Delete {animal.name}?</DialogTitle>
          <DialogContent>
            <Typography id="delete-text">
              {animal.name} will be removed from the board for everyone, with all their updates, likes and offers to
              help. This can&apos;t be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDelete(false)} autoFocus>
              Keep {animal.name}
            </Button>
            <Button color="error" variant="contained" onClick={remove}>
              Delete {animal.name}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <FormControl component="fieldset" sx={{ gap: 1 }}>
      <FormLabel component="legend" sx={{ mb: 1, fontSize: 14 }}>
        {label}
      </FormLabel>
      {children}
    </FormControl>
  );
}

/** A small set of exclusive choices, shown as a segmented control. */
function Choice<N extends FieldPath<AnimalDetailsForm>>({
  control,
  name,
  label,
  options,
}: {
  control: Control<AnimalDetailsForm>;
  name: N;
  label: string;
  options: [string, string][];
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormControl component="fieldset" error={!!fieldState.error} sx={{ flex: 1 }}>
          <FormLabel component="legend" sx={{ mb: 1, fontSize: 14 }}>
            {label}
          </FormLabel>
          <ToggleButtonGroup
            exclusive
            fullWidth
            color="primary"
            value={field.value}
            onChange={(_, v) => v !== null && field.onChange(v)}
            aria-label={label}
          >
            {options.map(([value, text]) => (
              <ToggleButton key={value} value={value} sx={{ textTransform: "none", py: 1 }}>
                {text}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
        </FormControl>
      )}
    />
  );
}
