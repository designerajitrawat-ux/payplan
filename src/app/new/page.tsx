import { Suspense } from "react";
import { SpecBuilder } from "./spec-builder";

export default function NewMilestonePage() {
  return (
    <Suspense>
      <SpecBuilder />
    </Suspense>
  );
}
