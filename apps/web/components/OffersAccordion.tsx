"use client";

import ExpandMore from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Animal } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";

/** A titled section that opens and closes, with a count beside the title. */
export function DetailAccordion({
  id,
  title,
  count,
  defaultExpanded = false,
  size = "compact",
  children,
}: {
  id: string;
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  /** "section" matches the page's other section cards (animal page); "compact" fits the side panel. */
  size?: "section" | "compact";
  children: React.ReactNode;
}) {
  const section = size === "section";
  const px = section ? { xs: 2, sm: 3 } : 2;
  return (
    <Accordion
      disableGutters
      variant="outlined"
      defaultExpanded={defaultExpanded}
      // MUI wraps the summary button in a heading (h3); style that one rather than nesting another inside it.
      slotProps={{ heading: { component: "h3" } }}
      sx={{
        borderRadius: 1, // the theme's corner radius, same as the cards around it
        overflow: "hidden",
        "&::before": { display: "none" },
        "& > h3": section ? { typography: "h6", fontWeight: 700 } : { fontWeight: 600 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        aria-controls={`${id}-content`}
        id={`${id}-header`}
        // Buttons don't inherit font by default; take the heading's size and weight.
        sx={{ px, font: "inherit", ...(section && { py: 1, "& .MuiAccordionSummary-content": { my: 1.5 } }) }}
      >
        <Box component="span" sx={{ font: "inherit" }}>
          {title}
          {count !== undefined &&
            (section ? (
              ` (${count})`
            ) : (
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                {" "}
                ({count})
              </Box>
            ))}
        </Box>
      </AccordionSummary>
      <AccordionDetails
        id={`${id}-content`}
        role="region"
        aria-labelledby={`${id}-header`}
        sx={{ px, pt: 0, pb: section ? { xs: 2, sm: 3 } : 2 }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * Offers to adopt or sponsor, for staff. They hold people's own messages (often
 * a phone number), so in the board's side panel they start closed.
 */
export function OffersAccordion({
  animal,
  defaultExpanded = false,
  size = "compact",
}: {
  animal: Animal;
  defaultExpanded?: boolean;
  size?: "section" | "compact";
}) {
  const users = useBoard((s) => s.users);
  const now = useNow();
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? "someone";

  return (
    <DetailAccordion
      id={`offers-${animal.id}`}
      title="Offers to help"
      count={animal.requests.length}
      defaultExpanded={defaultExpanded}
      size={size}
    >
        <Stack spacing={1.5}>
          {[...animal.requests].reverse().map((r) => (
            <Box key={`${r.userId}-${r.kind}`} sx={{ pl: 1.5, borderLeft: 2, borderColor: "mint.dark" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {name(r.userId)} would like to {r.kind}
              </Typography>
              {r.email && (
                <Link href={`mailto:${r.email}?subject=${encodeURIComponent(`About ${animal.name}`)}`} variant="body2" sx={{ display: "block", wordBreak: "break-all" }}>
                  {r.email}
                </Link>
              )}
              {r.message && (
                <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {r.message}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {timeAgo(r.at, now)}
              </Typography>
            </Box>
          ))}
        </Stack>
    </DetailAccordion>
  );
}
