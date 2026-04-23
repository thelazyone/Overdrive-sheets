import { createContext, useContext, type ParentProps, type Accessor } from "solid-js";
import type { SystemLibrary } from "./schema";

/** Resolves to the full library (on-disk + optional `dedicatedSystems` on the current ship). */
export const ShipLibraryContext = createContext<Accessor<SystemLibrary>>();

export function ShipLibraryProvider(props: ParentProps & { value: Accessor<SystemLibrary> }) {
  return (
    <ShipLibraryContext.Provider value={props.value}>
      {props.children}
    </ShipLibraryContext.Provider>
  );
}

export function useShipLibrary(): Accessor<SystemLibrary> {
  const ctx = useContext(ShipLibraryContext);
  if (!ctx) {
    throw new Error("useShipLibrary: ShipLibraryProvider is missing from the tree");
  }
  return ctx;
}
