import type { AlumniEntry, ImportedLine } from "./alumni-record";
import type { NonEmpty } from "./alumni-types";
import type { Photo } from "./types";

// The one-time import (issue #257): the Alumni page's years from before the
// team record held roles, as the hand-typed page listed them, in the old
// site's own groups. 2021–22 and 2022–23 come from the team's live page
// (politorocketteam.it/about/past-teams, read 2026-10-07) with roles tidied
// as board 28 does: "Lead Engineer" reads "Lead", "Mission Analyst - Safety
// And Launch Manager" reads "Mission Analyst · Safety and Launch Manager".
// The live "Luca Santoto" (2022–23) is Luca Santoro, as 2021–22 spells it,
// and 2021–22's "Ulvi Aydin" is Mustafa Ulvi Aydin, as 2022–23 names him.
// 2024–25's advisors come from the Team page's record (lib/about/team.ts):
// the roles hold no advisors, so they are imported as that year's Advisors.
//
// drizzle/0021_alumni_import.sql wrote this data into the database once; the
// dummy data reads it from here. Fixes from the dashboard never change it.

/** Someone in an imported group, with the role they held that year. */
export type ImportedAlum = { readonly name: string; readonly role: string };

/** A group of one imported year, as the old site lists it. */
export type ImportedGroup = { readonly name: string; readonly people: NonEmpty<ImportedAlum> };

/** One imported academic year: `start` is the calendar year it starts in (2022 is 2022–23). */
export type ImportedYear = { readonly start: number; readonly groups: NonEmpty<ImportedGroup> };

/** The founder marks and photos the hand-typed page gave, by name. */
export type ImportedFounder = { readonly name: string; readonly founder: "founder" | "co-founder"; readonly photo?: Photo };

export const importedFounders: NonEmpty<ImportedFounder> = [
  { name: "Fabio Meloni", founder: "founder", photo: "/team/fabio-meloni.jpg" },
  { name: "Mattia Saba", founder: "co-founder" },
  { name: "Salvatore Lagrasta", founder: "co-founder", photo: "/team/salvatore-lagrasta.jpg" },
  { name: "Andrea Ruscica", founder: "co-founder" },
  { name: "Cristian Manfredi", founder: "co-founder", photo: "/team/cristian-manfredi.jpg" },
  { name: "Andrea Troglia", founder: "co-founder" },
];

export const importedYears: NonEmpty<ImportedYear> = [
  {
    start: 2024,
    groups: [
      {
        name: "Advisors",
        people: [
          { name: "Prof. Alfonso Pagani", role: "Primary Faculty Advisor" },
          { name: "Prof. Enrico Zappino", role: "Faculty Advisor" },
          { name: "Fabio Meloni", role: "Founder & Senior Advisor" },
          { name: "Salvatore Lagrasta", role: "Avionics" },
          { name: "Cristian Manfredi", role: "Advisor" },
          { name: "Luca Loiodice", role: "Additive Manufacturing" },
          { name: "Francesca Bracaglia", role: "Finite Element Analysis" },
          { name: "Flora Punzi", role: "Senior FEA Analyst & Counselor" },
          { name: "Lorenzo Pezzolato", role: "Additive Manufacturing" },
          { name: "Matteo Postinghel", role: "Communication & Brand Strategy" },
          { name: "Edoardo Walter Bignami", role: "Communication & Brand Strategy" },
        ],
      },
    ],
  },
  {
    start: 2022,
    groups: [
      {
        name: "Executive",
        people: [
          { name: "Fabio Meloni", role: "President" },
          { name: "Elena Dilorenzo", role: "Chief Operating Officer" },
          { name: "Luca Santoro", role: "Chief Technologist & Head of Strategy" },
        ],
      },
      {
        name: "Cavour",
        people: [
          { name: "Fabio Meloni", role: "Chief Engineer" },
          { name: "Andrea Pantano", role: "Mission Analyst · Safety and Launch Manager" },
          { name: "Edoardo Viglietti", role: "Finite Element Analysis Lead" },
          { name: "Luca Loiodice", role: "Design & Additive Manufacturing Lead" },
          { name: "Marco Prodan", role: "Recovery & Manufacturing Lead" },
          { name: "Mattia Saba", role: "Mission Analysis Lead" },
          { name: "Orlando Nardo", role: "Design & Additive Manufacturing Vice-lead" },
          { name: "Salvatore Lagrasta", role: "Avionics Lead" },
          { name: "Alessandro Nitti", role: "CFD Analyst" },
          { name: "Alex Aiello", role: "Avionics Engineer" },
          { name: "Andrea De Masi", role: "Software Engineer" },
          { name: "Andrea Ruscica", role: "Mechanical Engineer" },
          { name: "Anna Del Tin", role: "Hardware Engineer" },
          { name: "Eliza Ciszewska", role: "Mechanical Engineer" },
          { name: "Emir Topakci", role: "CAD & AM Engineer" },
          { name: "Federico Guglielmi", role: "Software Engineer" },
          { name: "Giacomo Luccisano", role: "Avionics Engineer" },
          { name: "Giuseppe Barbera", role: "Avionics Engineer" },
          { name: "Giuseppe Roccasalva", role: "Software Engineer" },
          { name: "Giusi Raso", role: "CFD Analyst" },
          { name: "Hassine El Ghazel", role: "Software Engineer" },
          { name: "Jacopo Cerzosimo", role: "Software Engineer" },
          { name: "Kacper Koncewicz", role: "Mechanical Engineer" },
          { name: "Mattia Angirillo", role: "FEM Analyst" },
          { name: "Michał Zawadzki", role: "CAD & AM Engineer" },
          { name: "Mohammad Yousefi", role: "FEM Analyst" },
          { name: "Mustafa Ulvi Aydin", role: "Mechanical Engineer" },
          { name: "Nikita Fusilli Grynchenko", role: "FEM Analyst" },
          { name: "Pierantonio Bertuccio", role: "FEM Analyst" },
          { name: "Riccardo Di Maria", role: "CFD Analyst" },
          { name: "Samuele Martello", role: "Avionics Engineer" },
          { name: "Tuna Sahin", role: "Mechanical Engineer" },
        ],
      },
      {
        name: "Efesto",
        people: [
          { name: "Matteo Crachi", role: "Chief Engineer" },
          { name: "Cristian Manfredi", role: "Liquid Propulsion Coordinator" },
          { name: "Daniele Boccacciari", role: "Liquid System Architecture Lead" },
          { name: "Gloria Nallo", role: "Thrust Chamber Assembly Lead" },
          { name: "Lorenzo Guarino", role: "Engine Cycle Lead" },
          { name: "Luca Barnobi", role: "Test Bench Lead" },
          { name: "Pier Luigi Mercadante", role: "Liquid Propulsion Coordinator" },
          { name: "Abdullah Çelik", role: "Propulsion Engineer" },
          { name: "Alessio Improta", role: "Propulsion Engineer" },
          { name: "Alex Jarod Sclafani", role: "Propulsion Engineer" },
          { name: "Alireza Khanzadeh", role: "Propulsion Engineer" },
          { name: "Areeb Ahmed", role: "Propulsion Engineer" },
          { name: "Cosmo Spinosa", role: "Propulsion Engineer" },
          { name: "Davide Parlato", role: "Propulsion Engineer" },
          { name: "Edoardo Baraldi", role: "Propulsion Engineer" },
          { name: "El Sheikh Isber Charbel Abdo", role: "Propulsion Engineer" },
          { name: "Ezgi Yenigun", role: "Propulsion Engineer" },
          { name: "Federica Carollo", role: "Propulsion Engineer" },
          { name: "Federica Pellegrini", role: "Propulsion Engineer" },
          { name: "Gabriele Caso", role: "Propulsion Engineer" },
          { name: "Giovanni Ferrannini", role: "Propulsion Engineer" },
          { name: "Guglielmo Iacono", role: "Propulsion Engineer" },
          { name: "Harrshit Oruganti Sridhar", role: "Propulsion Engineer" },
          { name: "Hojjat Miryavifard", role: "Propulsion Engineer" },
          { name: "Iftekhar Anwar", role: "Propulsion Engineer" },
          { name: "İlayda Deniz Bayraktar", role: "Propulsion Engineer" },
          { name: "Marco Guzzon", role: "Propulsion Engineer" },
          { name: "Marco Magnanini", role: "Propulsion Engineer" },
          { name: "Marco Romano Delogu", role: "Propulsion Engineer" },
          { name: "Margherita Michahelles", role: "Propulsion Engineer" },
          { name: "Michele Bordini", role: "Propulsion Engineer" },
          { name: "Michele Sannino", role: "Propulsion Engineer" },
          { name: "Oshani Kularathna", role: "Propulsion Engineer" },
          { name: "Pierluigi Petrachi", role: "Propulsion Engineer" },
          { name: "Riccardo Terzo", role: "Propulsion Engineer" },
          { name: "Suleyman Burak Deniz", role: "Propulsion Engineer" },
          { name: "Syed Muhammad Ussama Zafar", role: "Propulsion Engineer" },
        ],
      },
      {
        name: "Operations",
        people: [
          { name: "Alessandro Di Nuzzo", role: "Media Manager" },
          { name: "Andrea Pantano", role: "Logistics Manager" },
          { name: "Federica Portis", role: "Sponsoring · Safety and Launch Manager" },
          { name: "Federico Guglielmi", role: "IT Manager" },
          { name: "Matteo Manavello", role: "Sponsoring Manager" },
          { name: "Derin Yilmaz", role: "Outreach & Recognition" },
          { name: "Duru Duran", role: "Photographer" },
          { name: "Ettore Giuseppe De Bartolo", role: "Recruitment" },
          { name: "Gabriele Tanca", role: "Outreach & Recognition" },
          { name: "Hassine El Ghazel", role: "Software Engineer" },
          { name: "Maria Vittoria Giobbio", role: "Outreach & Recognition" },
          { name: "Obaid Ur Rehman", role: "Web Developer" },
          { name: "Pierluigi Petrachi", role: "Propulsion Engineer" },
          { name: "Wassim Cherkaoui", role: "Outreach & Recognition" },
          { name: "Yuri Valle", role: "Graphic Designer" },
        ],
      },
      {
        name: "Advisors",
        people: [
          { name: "Flora Punzi", role: "Senior FEA Analyst & Counselor" },
          { name: "Francesca Bracaglia", role: "FEA Advisor" },
          { name: "Gianluca Porta", role: "Advisor · Strategy" },
          { name: "Gregorio Torchia", role: "Advisor · Legal" },
          { name: "Mattia Trombini", role: "Advisor · Engineering" },
          { name: "Rebecca Masia", role: "Advisor · Engineering" },
        ],
      },
    ],
  },
  {
    start: 2021,
    groups: [
      {
        name: "Operations",
        people: [
          { name: "Fabio Meloni", role: "President · Chief Engineer, Cavour" },
          { name: "Luca Santoro", role: "Chief Technologist & Head of Strategy" },
          { name: "Elena Dilorenzo", role: "Outreach & Recognition Coordinator" },
          { name: "Gregorio Torchia", role: "Legal Advisor" },
        ],
      },
      {
        name: "Avionics",
        people: [
          { name: "Salvatore Lagrasta", role: "Avionics Lead" },
          { name: "Giacomo Luccisano", role: "Avionics Engineer" },
          { name: "Federico Guglielmi", role: "Avionics Engineer & IT Manager" },
        ],
      },
      {
        name: "Liquid Propulsion",
        people: [
          { name: "Cristian Manfredi", role: "Propulsion Coordinator" },
          { name: "Pier Luigi Mercadante", role: "Propulsion Coordinator" },
        ],
      },
      {
        name: "Recovery & Mission Analysis",
        people: [
          { name: "Mattia Saba", role: "Lead Mission Analyst" },
          { name: "Andrea Ruscica", role: "Recovery Lead" },
          { name: "Andrea Troglia", role: "Recovery Lead" },
        ],
      },
      {
        name: "Aerostructures",
        people: [
          { name: "Francesca Bracaglia", role: "Aerostructures Lead" },
          { name: "Luca Loiodice", role: "CAD & Additive Manufacturing Lead" },
          { name: "Flora Punzi", role: "Senior FEA Analyst & Counselor" },
          { name: "Marco Prodan", role: "Manufacturing Specialist" },
          { name: "Edoardo Viglietti", role: "Structural Engineer & FEM Analyst" },
          { name: "Pierantonio Bertuccio", role: "FEM Analyst" },
          { name: "Mohammad Yousefi", role: "Structural Engineer" },
          { name: "Mustafa Ulvi Aydin", role: "Manufacturing Engineer" },
          { name: "Gianmatteo Migliore", role: "FEM Analyst" },
        ],
      },
    ],
  },
];

/**
 * The import as alumni entries and lines: one entry per name, in the order
 * the import first meets them, numbered from `firstId`; each line keeps its
 * place in the import, so the page lists the groups and people as it did.
 */
export function importedEntries(firstId = 1): { entries: AlumniEntry[]; imported: ImportedLine[] } {
  const ids = new Map<string, number>();
  const imported: ImportedLine[] = [];
  for (const year of importedYears) {
    for (const group of year.groups) {
      for (const person of group.people) {
        const id = ids.get(person.name) ?? firstId + ids.size;
        ids.set(person.name, id);
        imported.push({ entryId: id, year: year.start, group: group.name, role: person.role, position: imported.length });
      }
    }
  }
  const entries = [...ids].map(([name, id]): AlumniEntry => {
    const founder = importedFounders.find((f) => f.name === name);
    return {
      id,
      who: { kind: "imported", name },
      name: null,
      founder: founder?.founder ?? null,
      photo: founder?.photo ?? null,
      shown: true,
      removed: false,
      fixes: [],
    };
  });
  return { entries, imported };
}
