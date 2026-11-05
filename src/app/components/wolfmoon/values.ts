// Moved out of WolfMoon.tsx unchanged; see that file for how they are used.

/** True when a field holds nothing a cataloger entered (empty string, empty list, or a node with no text). */
export function isBlankValue(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.every(isBlankValue);
  if (typeof value === "object") {
    return Object.entries(value).every(([k, v]) => k === "@type" || k === "@id" && !v || isBlankValue(v));
  }
  return false;
}

export function getPropertyValue(data: any, uri: string): any {
  if (!data) return '';
  const key = uri.split("/").pop() || "";
  if (data[key] !== undefined && data[key] !== null && data[key] !== '') return data[key];
  if (data[`bf:${key}`] !== undefined && data[`bf:${key}`] !== null && data[`bf:${key}`] !== '') return data[`bf:${key}`];
  if (data[uri] !== undefined && data[uri] !== null && data[uri] !== '') return data[uri];

  if (uri.includes('classificationLcc')) return data['bf:classification'] || data['classification'] || '';
  if (uri.includes('classificationDdc')) return data['classificationDdc'] || '';
  if (uri.includes('subject/topical')) return data['subjectTopical'] || data['bf:subject'] || data['subject'] || '';
  if (uri.includes('subject/geographic')) return data['subjectGeographic'] || data['geographicCoverage'] || '';
  if (uri.includes('subject/name')) return data['subjectName'] || data['creator'] || '';
  if (uri.includes('geographicAreaCode')) return data['geographicAreaCode'] || '';
  if (uri.includes('geographicCoverage')) return data['geographicCoverage'] || '';
  if (uri.includes('intendedAudience')) return data['intendedAudience'] || '';
  if (uri.includes('contribution/primary')) return data['creator'] || data['contribution'] || '';
  if (uri.includes('contribution/additional')) return data['additionalContributors'] || '';
  if (uri.includes('seriesStatement')) return data['seriesStatement'] || data['hasSeries'] || '';
  if (uri.includes('illustrativeContent')) return data['illustrativeContent'] || '';
  if (uri.includes('supplementaryContent')) return data['supplementaryContent'] || '';
  if (uri.includes('issuance')) return data['issuance'] || data['bf:issuance'] || '';

  if (key === 'title') return data['bf:title'] || data['mainTitle'] || data['title'] || '';
  if (key === 'contribution') return data['bf:contribution'] || data['creator'] || data['contribution'] || '';
  if (key === 'subject') return data['bf:subject'] || data['subject'] || '';
  if (key === 'classification') return data['bf:classification'] || data['classification'] || '';
  if (key === 'language') return data['bf:language'] || data['language'] || '';
  if (key === 'provisionActivity' || key === 'publication') return data['bf:provisionActivity'] || data['publicationDate'] || data['provisionActivity'] || '';
  if (key === 'extent') return data['bf:extent'] || data['extent'] || '';
  if (key === 'summary') return data['bf:summary'] || data['summary'] || '';
  if (key === 'note') return data['bf:note'] || data['note'] || '';
  if (key === 'originDate') return data['bf:originDate'] || data['originDate'] || data['date'] || '';
  if (key === 'originPlace') return data['bf:originPlace'] || data['originPlace'] || data['place'] || '';
  if (key === 'genreForm') return data['bf:genreForm'] || data['genreForm'] || '';
  if (key === 'identifiedBy') return data['bf:identifiedBy'] || data['identifiedBy'] || data['identifier'] || data['lccn'] || '';
  if (key === 'dimensions') return data['bf:dimensions'] || data['dimensions'] || '';
  if (key === 'media') return data['bf:media'] || data['media'] || data['mediaType'] || '';
  if (key === 'carrier') return data['bf:carrier'] || data['carrier'] || data['carrierType'] || '';
  if (key === 'content') return data['bf:content'] || data['content'] || data['contentType'] || '';
  if (key === 'editionStatement') return data['bf:editionStatement'] || data['editionStatement'] || data['edition'] || '';
  if (key === 'responsibilityStatement') return data['bf:responsibilityStatement'] || data['responsibilityStatement'] || data['statementOfResponsibility'] || '';
  if (key === 'tableOfContents') return data['bf:tableOfContents'] || data['tableOfContents'] || '';
  if (key === 'hasSeries') return data['bf:hasSeries'] || data['hasSeries'] || '';
  if (key === 'copyrightDate') return data['bf:copyrightDate'] || data['copyrightDate'] || '';
  if (key === 'accessibilityContent') return data['bf:accessibilityContent'] || data['accessibilityContent'] || '';
  if (key === 'notation') return data['bf:notation'] || data['notation'] || '';
  if (key === 'governmentPublication') return data['bf:governmentPublication'] || data['governmentPublication'] || '';
  if (key === 'dissertation') return data['bf:dissertation'] || data['dissertation'] || '';
  if (key === 'acquisitionSource') return data['bf:acquisitionSource'] || data['acquisitionSource'] || '';
  if (key === 'immediateAcquisition') return data['bf:immediateAcquisition'] || data['immediateAcquisition'] || '';
  if (key === 'heldBy') return data['bf:heldBy'] || data['heldBy'] || '';
  if (key === 'shelfMark') return data['bf:shelfMark'] || data['shelfMark'] || '';
  if (key === 'expressionOf') return data['bf:expressionOf'] || data['expressionOf'] || '';
  if (key === 'hasExpression') return data['bf:hasExpression'] || data['hasExpression'] || '';
  if (key === 'hasInstance') return data['bf:hasInstance'] || data['hasInstance'] || '';
  if (key === 'instanceOf') return data['bf:instanceOf'] || data['instanceOf'] || '';
  if (key === 'partOf') return data['bf:partOf'] || data['partOf'] || '';
  if (key === 'hasPart') return data['bf:hasPart'] || data['hasPart'] || '';
  if (key === 'relatedTo') return data['bf:relatedTo'] || data['relatedTo'] || '';
  if (key === 'translationOf') return data['bf:translationOf'] || data['translationOf'] || '';
  if (key === 'originalVersion') return data['bf:originalVersion'] || data['originalVersion'] || '';
  if (key === 'hasDerivative') return data['bf:hasDerivative'] || data['hasDerivative'] || '';
  if (key === 'adminMetadata') return data['bf:adminMetadata'] || data['adminMetadata'] || '';
  return '';
}

export function shortenUri(uri: string): string {
  if (!uri) return "";
  return uri
    .replace("http://id.loc.gov/ontologies/bibframe/", "bf:")
    .replace("http://id.loc.gov/vocabulary/relators/", "rel:")
    .replace("http://id.loc.gov/vocabulary/languages/", "lang:")
    .replace("http://id.loc.gov/vocabulary/carriers/", "carrier:")
    .replace("http://id.loc.gov/vocabulary/mediaTypes/", "media:")
    .replace("http://id.loc.gov/vocabulary/countries/", "country:")
    .replace("http://id.loc.gov/authorities/names/", "naf:")
    .replace("http://id.loc.gov/authorities/subjects/", "lcsh:")
    .replace("http://id.loc.gov/authorities/genreForms/", "lcgft:")
    .replace("http://www.w3.org/2000/01/rdf-schema#", "rdfs:")
    .replace("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:")
    .replace("http://www.w3.org/2001/XMLSchema#", "xsd:")
    .replace("https://moonlib.org/resource/", "moon:")
    .replace("https://moonlib.org/", "moon:");
}
