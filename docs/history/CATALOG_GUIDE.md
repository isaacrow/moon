# BIBFRAME 2.0 Cataloging Application

## Overview
This is a professional web-based cataloging application for creating bibliographic records using the BIBFRAME 2.0 model. The application is inspired by Marva (Library of Congress) and Sinopia (LD4P).

## Features

### Three-Pane Interface
- **Left Pane**: BIBFRAME Work entity - intellectual/artistic content
- **Middle Pane**: BIBFRAME Instance entity - physical/digital embodiment
- **Right Pane**: Live preview in JSON-LD and MARC formats

### Work Entity Fields
The Work pane includes the following sections:

#### Title Information
- Preferred Title (Work Title) - *Required*

#### Creators & Contributors
- **Creator of Work**: Autocomplete lookup against Library of Congress Name Authority File (LCNAF)
- **Contributors**: Additional creators with LCNAF lookup

#### Subjects & Genre
- **Subjects**: Topic, Place, and Person subjects with Library of Congress Subject Headings (LCSH) lookup
- **Genre/Form**: Genre and form terms with Library of Congress Genre/Form Terms (LCGFT) lookup

#### Classification
- Library of Congress Classification (LCC)
- Dewey Decimal Classification (DDC)

#### Content Attributes
- Language (ISO 639-2 codes)
- Content Type (RDA content types)

#### Summary & Notes
- Summary/Abstract
- General notes

### Instance Entity Fields
The Instance pane includes:

#### Title Information
- Main Title (Instance Title) - *Required*
- Statement of Responsibility

#### Edition
- Edition Statement

#### Publication Information
- Place of Publication
- Publisher
- Publication Date

#### Mode of Issuance
- Single unit, Serial, Integrating resource, or Multipart monograph

#### Identifiers
- LCCN (Library of Congress Control Number)
- ISBN (International Standard Book Number)
- Multiple identifiers supported

#### Carrier & Media
- Carrier Type (volume, online resource, disc, etc.)
- Media Type (unmediated, computer, audio, video)

#### Physical Description
- Extent (pagination, size)
- Dimensions

## Key Features

### Authority Lookups
All creator, contributor, subject, and genre/form fields feature autocomplete functionality that simulates queries to Library of Congress authorities:
- Type at least 2 characters to trigger the search
- Results appear in a dropdown with URI and label
- Use arrow keys to navigate, Enter to select
- Multiple selections supported with removable badges

### Live Preview
- **JSON-LD Format**: Complete BIBFRAME 2.0 record in JSON-LD format
- **MARC Preview**: Simplified MARC-like display for catalogers familiar with MARC21
- Copy to clipboard functionality
- Download as JSON file

### Data Management
- **Load Example**: Pre-populate fields with a sample record (Pride and Prejudice)
- **Reset**: Clear all fields and start fresh
- **Download**: Export your BIBFRAME record as JSON-LD

## Technical Implementation

### BIBFRAME 2.0 Compliance
The application generates valid BIBFRAME 2.0 JSON-LD with proper:
- RDF namespaces and context
- Work-Instance relationship linking
- Proper URI references to Library of Congress vocabularies
- Controlled vocabulary adherence

### Mock Authority Services
The application includes mock data for:
- LCNAF (Library of Congress Name Authority File) - ~12 example names
- LCSH (Library of Congress Subject Headings) - ~12 example terms
- LCGFT (Library of Congress Genre/Form Terms) - ~9 example terms

In a production environment, these would connect to real id.loc.gov APIs.

## Usage Tips

1. **Start with the Work**: Begin by entering the preferred title and creator
2. **Add Subjects**: Use the autocomplete to find appropriate subject headings
3. **Complete the Instance**: Fill in publication details and physical description
4. **Review Preview**: Check the JSON-LD output in the right pane
5. **Download**: Save your completed record

## Keyboard Shortcuts
When using autocomplete fields:
- `Arrow Down/Up`: Navigate results
- `Enter`: Select highlighted result
- `Escape`: Close dropdown

## Browser Support
This application works best in modern browsers with JavaScript enabled.
