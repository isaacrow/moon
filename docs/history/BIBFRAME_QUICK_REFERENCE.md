# BIBFRAME 3.0.1 Quick Reference Guide

## Common Use Cases

### 1. Creating a Basic Text Work

```typescript
import { BFText, BFPrint, BFContribution, BFPerson } from './src/app/types/bibframe3';

const work: BFText = {
  '@type': 'bf:Text',
  '@id': 'http://example.org/work/12345',
  'bf:title': [{
    '@type': 'bf:Title',
    'bf:mainTitle': 'Introduction to Cataloging',
    'bf:subtitle': 'A Practical Guide'
  }],
  'bf:contribution': [{
    '@type': 'bf:PrimaryContribution',
    'bf:agent': {
      '@type': 'bf:Person',
      '@id': 'http://id.loc.gov/rwo/agents/n79021164',
      'rdfs:label': 'Smith, John'
    },
    'bf:role': [{
      '@type': 'bf:Role',
      '@id': 'http://id.loc.gov/vocabulary/relators/aut',
      'rdfs:label': 'Author'
    }]
  }],
  'bf:language': [{
    '@type': 'bf:Language',
    '@id': 'http://id.loc.gov/vocabulary/languages/eng',
    'rdfs:label': 'English'
  }],
  'bf:subject': [{
    '@type': 'bf:Topic',
    '@id': 'http://id.loc.gov/authorities/subjects/sh85026723',
    'rdfs:label': 'Cataloging'
  }],
  'bf:classification': [{
    '@type': 'bf:ClassificationLcc',
    'bf:classificationPortion': 'Z693',
    'bf:assigner': {
      '@type': 'bf:Organization',
      '@id': 'http://id.loc.gov/vocabulary/organizations/dlc',
      'rdfs:label': 'Library of Congress'
    }
  }]
};

const instance: BFPrint = {
  '@type': 'bf:Print',
  '@id': 'http://example.org/instance/12345',
  'bf:instanceOf': work,
  'bf:title': [{
    '@type': 'bf:Title',
    'bf:mainTitle': 'Introduction to Cataloging',
    'bf:subtitle': 'A Practical Guide'
  }],
  'bf:provisionActivity': [{
    '@type': 'bf:Publication',
    'bf:agent': [{
      '@type': 'bf:Organization',
      'rdfs:label': 'Academic Press'
    }],
    'bf:place': [{
      '@type': 'bf:Place',
      '@id': 'http://id.loc.gov/vocabulary/countries/nyu',
      'rdfs:label': 'New York'
    }],
    'bf:date': '2024'
  }],
  'bf:identifiedBy': [{
    '@type': 'bf:Isbn',
    'rdf:value': '978-0-12-345678-9'
  }],
  'bf:extent': [{
    '@type': 'bf:Extent',
    'rdfs:label': 'xii, 345 pages'
  }],
  'bf:dimensions': '24 cm'
};
```

### 2. Creating a Music Work

```typescript
import { BFNotatedMusic, BFMusicEnsemble } from './src/app/types/bibframe3';

const musicWork: BFNotatedMusic = {
  '@type': 'bf:NotatedMusic',
  '@id': 'http://example.org/work/music-123',
  'bf:title': [{
    '@type': 'bf:Title',
    'bf:mainTitle': 'Symphony No. 5 in C minor',
    'bf:partNumber': 'Op. 67'
  }],
  'bf:contribution': [{
    '@type': 'bf:PrimaryContribution',
    'bf:agent': {
      '@type': 'bf:Person',
      '@id': 'http://id.loc.gov/rwo/agents/n79107741',
      'rdfs:label': 'Beethoven, Ludwig van, 1770-1827'
    },
    'bf:role': [{
      '@type': 'bf:Role',
      '@id': 'http://id.loc.gov/vocabulary/relators/cmp',
      'rdfs:label': 'Composer'
    }]
  }],
  'bf:musicFormat': [{
    '@type': 'bf:MusicFormat',
    '@id': 'http://id.loc.gov/vocabulary/mmusicformat/score',
    'rdfs:label': 'score'
  }],
  'bf:ensemble': [{
    '@type': 'bf:MusicEnsemble',
    'bf:ensembleType': 'orchestra',
    'bf:mediumComponent': [{
      '@type': 'bf:MediumComponent',
      'bf:mediumOfPerformance': {
        '@type': 'bf:MediumOfPerformance',
        'rdfs:label': 'orchestra'
      },
      'bf:count': 1
    }]
  }],
  'bf:notation': [{
    '@type': 'bf:MusicNotation',
    'rdfs:label': 'staff notation'
  }],
  'bf:keyMode': [{
    '@type': 'bf:KeyMode',
    'rdfs:label': 'C minor'
  }]
};
```

### 3. Creating a Cartographic Work

```typescript
import { BFCartography, BFCartographic } from './src/app/types/bibframe3';

const mapWork: BFCartography = {
  '@type': 'bf:Cartography',
  '@id': 'http://example.org/work/map-456',
  'bf:title': [{
    '@type': 'bf:Title',
    'bf:mainTitle': 'Map of Washington, D.C.'
  }],
  'bf:cartographicAttributes': [{
    '@type': 'bf:Cartographic',
    'bf:scale': [{
      '@type': 'bf:Scale',
      'rdfs:label': 'Scale 1:24,000'
    }],
    'bf:projection': [{
      '@type': 'bf:Projection',
      '@id': 'http://id.loc.gov/vocabulary/mprojection/aa',
      'rdfs:label': 'Transverse Mercator'
    }],
    'bf:coordinates': 'W0770000 W0765500 N0390000 N0385000',
    'bf:relief': [{
      '@type': 'bf:Relief',
      '@id': 'http://id.loc.gov/vocabulary/mrelief/cont',
      'rdfs:label': 'Contours'
    }]
  }]
};
```

### 4. Using Controlled Vocabularies

```typescript
import { controlledVocabularyService } from './src/app/services/controlledVocabularyService';

// Get all carriers
const carriers = await controlledVocabularyService.getCarriers();
// Returns: [{ id: 'nc', uri: '...', label: 'volume', code: 'nc' }, ...]

// Search for languages
const languages = await controlledVocabularyService.getLanguages('arabic');
// Returns matching languages

// Get relator roles
const roles = await controlledVocabularyService.getRelatorRoles('composer');
// Returns: [{ id: 'cmp', uri: '...', label: 'Composer', code: 'cmp' }]

// Get content types
const contentTypes = await controlledVocabularyService.getContentTypes();
// Returns all content types

// Search subjects
const subjects = await controlledVocabularyService.searchSubjects('history');
// Returns matching LCSH terms
```

### 5. Creating an Electronic Resource

```typescript
import { BFElectronic } from './src/app/types/bibframe3';

const electronicInstance: BFElectronic = {
  '@type': 'bf:Electronic',
  '@id': 'http://example.org/instance/ebook-789',
  'bf:instanceOf': work,
  'bf:electronicLocator': 'https://example.com/ebook/789',
  'bf:carrier': [{
    '@type': 'bf:Carrier',
    '@id': 'http://id.loc.gov/vocabulary/carriers/cr',
    'rdfs:label': 'online resource'
  }],
  'bf:media': [{
    '@type': 'bf:Media',
    '@id': 'http://id.loc.gov/vocabulary/mediaTypes/c',
    'rdfs:label': 'computer'
  }],
  'bf:digitalCharacteristic': [{
    '@type': 'bf:FileType',
    '@id': 'http://id.loc.gov/vocabulary/mfiletype/text',
    'rdfs:label': 'text file'
  }, {
    '@type': 'bf:EncodingFormat',
    'rdfs:label': 'PDF'
  }]
};
```

### 6. Adding Multiple Identifiers

```typescript
const instance: BFInstance = {
  '@type': 'bf:Instance',
  '@id': 'http://example.org/instance/multi-id',
  'bf:identifiedBy': [
    {
      '@type': 'bf:Isbn',
      'rdf:value': '978-0-12-345678-9',
      'bf:qualifier': 'hardcover'
    },
    {
      '@type': 'bf:Lccn',
      'rdf:value': '2024012345'
    },
    {
      '@type': 'bf:Doi',
      'rdf:value': '10.1234/example.2024.001'
    },
    {
      '@type': 'bf:Local',
      'rdf:value': 'LOCAL-123-456',
      'bf:assigner': {
        '@type': 'bf:Organization',
        'rdfs:label': 'My Library'
      }
    }
  ]
};
```

### 7. Creating an Audio Resource

```typescript
import { BFMusicAudio } from './src/app/types/bibframe3';

const audioWork: BFMusicAudio = {
  '@type': 'bf:MusicAudio',
  '@id': 'http://example.org/work/audio-101',
  'bf:title': [{
    '@type': 'bf:Title',
    'bf:mainTitle': 'The Four Seasons'
  }],
  'bf:contribution': [{
    '@type': 'bf:Contribution',
    'bf:agent': {
      '@type': 'bf:Person',
      'rdfs:label': 'Vivaldi, Antonio'
    },
    'bf:role': [{
      '@type': 'bf:Role',
      'rdfs:label': 'Composer'
    }]
  }],
  'bf:soundContent': [{
    '@type': 'bf:SoundContent',
    '@id': 'http://id.loc.gov/vocabulary/msoundcontent/sound',
    'rdfs:label': 'sound'
  }]
};

const audioInstance: BFInstance = {
  '@type': 'bf:Instance',
  '@id': 'http://example.org/instance/audio-101',
  'bf:instanceOf': audioWork,
  'bf:carrier': [{
    '@type': 'bf:Carrier',
    '@id': 'http://id.loc.gov/vocabulary/carriers/sd',
    'rdfs:label': 'audio disc'
  }],
  'bf:soundCharacteristic': [{
    '@type': 'bf:RecordingMethod',
    '@id': 'http://id.loc.gov/vocabulary/mrectype/digital',
    'rdfs:label': 'digital'
  }, {
    '@type': 'bf:PlaybackChannels',
    '@id': 'http://id.loc.gov/vocabulary/mplayback/ste',
    'rdfs:label': 'stereo'
  }]
};
```

### 8. Complete Record with Item

```typescript
import { BibframeRecord, BFWork, BFInstance, BFItem } from './src/app/types/bibframe3';

const work: BFWork = {
  '@type': 'bf:Work',
  '@id': 'http://example.org/work/complete-1',
  'bf:title': [{
    '@type': 'bf:Title',
    'bf:mainTitle': 'Complete Example'
  }]
};

const instance: BFInstance = {
  '@type': 'bf:Instance',
  '@id': 'http://example.org/instance/complete-1',
  'bf:instanceOf': work
};

const item: BFItem = {
  '@type': 'bf:Item',
  '@id': 'http://example.org/item/complete-1',
  'bf:itemOf': instance,
  'bf:heldBy': {
    '@type': 'bf:Organization',
    '@id': 'http://id.loc.gov/vocabulary/organizations/dlc',
    'rdfs:label': 'Library of Congress'
  },
  'bf:shelfMark': [{
    '@type': 'bf:ShelfMarkLcc',
    'rdf:value': 'Z693 .S65 2024'
  }],
  'bf:enumerationAndChronology': [{
    '@type': 'bf:Enumeration',
    'rdfs:label': 'v. 1'
  }]
};

const record: BibframeRecord = {
  '@context': {
    bf: 'http://id.loc.gov/ontologies/bibframe/',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    madsrdf: 'http://www.loc.gov/mads/rdf/v1#',
  },
  '@graph': [work, instance, item]
};

// Export as JSON-LD
const jsonld = JSON.stringify(record, null, 2);
```

## Common Vocabulary URIs

### Content Types
- Text: `http://id.loc.gov/vocabulary/contentTypes/txt`
- Still Image: `http://id.loc.gov/vocabulary/contentTypes/sti`
- Moving Image: `http://id.loc.gov/vocabulary/contentTypes/tdi`
- Spoken Word: `http://id.loc.gov/vocabulary/contentTypes/spw`
- Performed Music: `http://id.loc.gov/vocabulary/contentTypes/prm`
- Notated Music: `http://id.loc.gov/vocabulary/contentTypes/ntm`

### Carriers
- Volume: `http://id.loc.gov/vocabulary/carriers/nc`
- Online Resource: `http://id.loc.gov/vocabulary/carriers/cr`
- Audio Disc: `http://id.loc.gov/vocabulary/carriers/sd`
- Videodisc: `http://id.loc.gov/vocabulary/carriers/vd`

### Media Types
- Unmediated: `http://id.loc.gov/vocabulary/mediaTypes/n`
- Computer: `http://id.loc.gov/vocabulary/mediaTypes/c`
- Audio: `http://id.loc.gov/vocabulary/mediaTypes/s`
- Video: `http://id.loc.gov/vocabulary/mediaTypes/v`

### Issuance
- Single Unit: `http://id.loc.gov/vocabulary/issuance/mono`
- Serial: `http://id.loc.gov/vocabulary/issuance/serl`
- Multipart Monograph: `http://id.loc.gov/vocabulary/issuance/mulm`

### Common Relator Roles
- Author: `http://id.loc.gov/vocabulary/relators/aut`
- Editor: `http://id.loc.gov/vocabulary/relators/edt`
- Translator: `http://id.loc.gov/vocabulary/relators/trl`
- Illustrator: `http://id.loc.gov/vocabulary/relators/ill`
- Composer: `http://id.loc.gov/vocabulary/relators/cmp`
- Performer: `http://id.loc.gov/vocabulary/relators/prf`
- Publisher: `http://id.loc.gov/vocabulary/relators/pbl`

## Helpful Type Guards

```typescript
// Check if a work is a Text
function isText(work: BFWorkType): work is BFText {
  return work['@type'] === 'bf:Text';
}

// Check if an instance is Electronic
function isElectronic(instance: BFInstanceType): instance is BFElectronic {
  return instance['@type'] === 'bf:Electronic';
}

// Check if an identifier is ISBN
function isIsbn(id: BFIdentifierType): id is BFIsbn {
  return id['@type'] === 'bf:Isbn';
}
```

## Best Practices

1. **Always use URI references** for controlled vocabulary terms
2. **Include both @id and rdfs:label** for agents, subjects, and controlled terms
3. **Use proper subclasses** (e.g., BFText instead of just BFWork)
4. **Link Work, Instance, and Item** properly with instanceOf and itemOf
5. **Use controlled vocabularies** from LOC where available
6. **Include administrative metadata** for provenance tracking
7. **Validate against BIBFRAME schema** before export

## Common Pitfalls to Avoid

❌ **Don't hardcode labels** - use URIs with controlled vocabularies
❌ **Don't forget @type** - always specify the resource type
❌ **Don't skip relationships** - link Work to Instance to Item
❌ **Don't use invalid URIs** - verify URIs exist in LOC vocabularies
❌ **Don't forget language tags** - use xml:lang for multilingual content

## Resources

- Full type definitions: `/src/app/types/bibframe3.ts`
- Controlled vocabularies: `/src/app/services/controlledVocabularyService.ts`
- Ontology browser: Access from Moon Dashboard
- Official documentation: http://id.loc.gov/ontologies/bibframe.html
