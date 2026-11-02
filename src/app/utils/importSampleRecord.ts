/**
 * Import sample record utility
 * This function imports a specific BIBFRAME record into the database
 */
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { moonHeaders } from './moonApi';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c`;

export async function importAliRecord() {
  const recordData = {
    "@context": "http://id.loc.gov/ontologies/bibframe/",
    "@graph": [
      {
        "@id": "http://moon.local/work/e33e4802-c2c4-4388-9c2d-e7e2fd76db91",
        "@type": [
          "http://id.loc.gov/ontologies/bibframe/Work",
          "bf:Work"
        ],
        "title": "http://moon.local/node/295bee99-77df-4959-972b-9e0dabd781bc",
        "subject": [
          "http://id.loc.gov/authorities/subjects/sh2002005123",
          "http://id.loc.gov/authorities/subjects/sh96010368"
        ],
        "geographicCoverage": "http://id.loc.gov/vocabulary/geographicAreas/a-iq",
        "language": "http://id.loc.gov/vocabulary/languages/ara",
        "content": "http://id.loc.gov/vocabulary/contentTypes/txt",
        "genreForm": "http://id.loc.gov/authorities/subjects/sh2009008682-781",
        "originDate": "2026",
        "originPlace": "http://id.loc.gov/vocabulary/geographicAreas/a-iq",
        "intendedAudience": "http://moon.local/node/bd73d257-b3f7-4e14-a2b2-e4d9ac16c5e5",
        "summary": "http://moon.local/node/c7f20057-a3be-470c-9f2d-1ea994e32264",
        "tableOfContents": "http://moon.local/node/41132f18-51f8-4188-b452-c726f4bf189b",
        "note": "http://moon.local/node/337b05f2-153b-4ea9-b21f-2a4b69413cb8",
        "topical": "http://id.loc.gov/authorities/subjects/sh85068390",
        "adminMetadata": "http://moon.local/node/c9140982-5029-4d8c-830f-9b5639a4af12"
      },
      {
        "@id": "http://moon.local/node/295bee99-77df-4959-972b-9e0dabd781bc",
        "@type": "bf:Title",
        "mainTitle": "Ali b. Abi Talib :",
        "subtitle": "Rereading Historical Sources"
      },
      {
        "@id": "http://moon.local/node/bd73d257-b3f7-4e14-a2b2-e4d9ac16c5e5",
        "@type": "bf:IntendedAudience",
        "value": "musims"
      },
      {
        "@id": "http://moon.local/node/c7f20057-a3be-470c-9f2d-1ea994e32264",
        "@type": "bf:Summary",
        "value": "speaks abou imam ali "
      },
      {
        "@id": "http://moon.local/node/41132f18-51f8-4188-b452-c726f4bf189b",
        "@type": "bf:TableOfContents",
        "value": "includes ali bin abi talb biography "
      },
      {
        "@id": "http://moon.local/node/337b05f2-153b-4ea9-b21f-2a4b69413cb8",
        "@type": "bf:Note",
        "value": "include indexing"
      },
      {
        "@id": "http://moon.local/node/c9140982-5029-4d8c-830f-9b5639a4af12",
        "@type": "bf:AdminMetadata",
        "value": "isaac"
      },
      {
        "@id": "http://moon.local/instance/368db8ba-f8d2-4c49-9c1b-90437b74ce5e",
        "@type": [
          "http://id.loc.gov/ontologies/bibframe/Instance",
          "bf:Instance"
        ],
        "instanceOf": "http://moon.local/work/e33e4802-c2c4-4388-9c2d-e7e2fd76db91",
        "dimensions": "24 cm ",
        "media": "http://id.loc.gov/vocabulary/mediaTypes/c",
        "carrier": "http://id.loc.gov/vocabulary/carriers/cr",
        "editionStatement": "First edition. ",
        "responsibilityStatement": "By Mohammad reza al-Khaghani ; Translator : Yasser Pouresmaeil. ",
        "seriesStatement": "1000 year of najaf hawza"
      }
    ]
  };

  try {
    const response = await fetch(`${API_BASE}/records/save`, {
      method: 'POST',
      headers: {
        ...moonHeaders(),
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        id: `record-ali-${Date.now()}`,
        document: recordData,
        title: 'Ali b. Abi Talib : Rereading Historical Sources'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to import Ali record:', errorText);
      throw new Error(`Failed to import record: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Ali b. Abi Talib record imported successfully:', data);
    return data;
  } catch (error) {
    console.error('Error importing Ali record:', error);
    throw error;
  }
}