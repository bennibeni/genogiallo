"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import GenerationView from "@/components/GenerationView";
import { useAppState } from "@/lib/store";

export default function GenerazionePage() {
  const router = useRouter();
  const {
    data,
    kase,
    handleOpenDetail,
    gruppiGenerazioneNascosti,
    nascondiGruppoGenerazione,
    settings,
    activeClues,
    matchIds,
    generazioneNota,
  } = useAppState();

  // Essendo ora una rotta vera (non più una vista interna raggiungibile
  // solo dal link che compariva dopo aver rivelato l'indizio), qualcuno
  // potrebbe scrivere /generazione direttamente nell'URL prima ancora di
  // aver richiesto "Generazione" — GenerationView userebbe comunque il
  // valore VERO (kase.clues.generazione, non activeClues), uno spoiler
  // bello e buono. Si torna a "/" finché l'indizio non è stato richiesto.
  useEffect(() => {
    if (!generazioneNota) router.replace("/");
  }, [generazioneNota, router]);

  if (!generazioneNota) return null;

  return (
    <GenerationView
      data={data}
      kase={kase}
      onOpenDetail={handleOpenDetail}
      onClose={() => router.push("/")}
      nascosti={gruppiGenerazioneNascosti}
      onNascondi={nascondiGruppoGenerazione}
      showDismissButton={settings.showGenerationDismissButton}
      showTooltips={settings.showSuspectTooltips}
      lettera={activeClues?.biglietto || null}
      filterIndividualsByLetter={settings.filterGenerationIndividualsByLetter}
      matchIds={matchIds}
      highlightMatches={settings.highlightIndiziatiInGenerationView}
    />
  );
}
