/**
 * ISBNdb Client
 * Uses the server proxy to securely access ISBNdb API
 */
import { projectId } from '../../../utils/supabase/info';
import { moonHeaders } from './moonApi';
import type { ISBNdbBook, ISBNdbSearchResult, ISBNdbAuthorDetails } from './isbndbApi';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c`;

/**
 * Get book details by ISBN
 */
export async function getBookByISBN(isbn: string): Promise<ISBNdbBook | null> {
  try {
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    
    const response = await fetch(`${API_BASE}/isbndb/book/${cleanIsbn}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('ISBNdb: Book not found (may be added soon)');
        return null;
      }
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.book || null;
  } catch (error) {
    console.error('Error fetching book from ISBNdb:', error);
    throw error;
  }
}

/**
 * Get multiple books by ISBN (batch)
 */
export async function getBooksByISBNs(isbns: string[]): Promise<ISBNdbBook[]> {
  try {
    const response = await fetch(`${API_BASE}/isbndb/books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...moonHeaders(),
      },
      body: JSON.stringify({ isbns }),
    });

    if (!response.ok) {
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.books || [];
  } catch (error) {
    console.error('Error fetching books from ISBNdb:', error);
    throw error;
  }
}

/**
 * Search books by query
 */
export async function searchBooks(
  query: string, 
  page: number = 1,
  pageSize: number = 20
): Promise<ISBNdbSearchResult> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    const response = await fetch(`${API_BASE}/isbndb/search/books/${encodeURIComponent(query)}?${params}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      total: data.total || 0,
      books: data.books || [],
    };
  } catch (error) {
    console.error('Error searching books in ISBNdb:', error);
    throw error;
  }
}

/**
 * Search for authors
 */
export async function searchAuthors(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ total: number; authors: any[] }> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    const response = await fetch(`${API_BASE}/isbndb/search/authors/${encodeURIComponent(query)}?${params}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      total: data.total || 0,
      authors: data.authors || [],
    };
  } catch (error) {
    console.error('Error searching authors in ISBNdb:', error);
    throw error;
  }
}

/**
 * Get author details
 */
export async function getAuthorDetails(authorName: string): Promise<ISBNdbAuthorDetails | null> {
  try {
    const response = await fetch(`${API_BASE}/isbndb/author/${encodeURIComponent(authorName)}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching author from ISBNdb:', error);
    throw error;
  }
}

/**
 * Search publishers
 */
export async function searchPublishers(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ total: number; publishers: any[] }> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    const response = await fetch(`${API_BASE}/isbndb/search/publishers/${encodeURIComponent(query)}?${params}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      total: data.total || 0,
      publishers: data.publishers || [],
    };
  } catch (error) {
    console.error('Error searching publishers in ISBNdb:', error);
    throw error;
  }
}

/**
 * Search subjects
 */
export async function searchSubjects(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ total: number; subjects: any[] }> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    const response = await fetch(`${API_BASE}/isbndb/search/subjects/${encodeURIComponent(query)}?${params}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      total: data.total || 0,
      subjects: data.subjects || [],
    };
  } catch (error) {
    console.error('Error searching subjects in ISBNdb:', error);
    throw error;
  }
}

/**
 * Get publisher details
 */
export async function getPublisherDetails(publisherName: string): Promise<{ name: string; books: any[] } | null> {
  try {
    const response = await fetch(`${API_BASE}/isbndb/publisher/${encodeURIComponent(publisherName)}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching publisher from ISBNdb:', error);
    throw error;
  }
}

/**
 * Get subject details
 */
export async function getSubjectDetails(subjectName: string): Promise<{ name: string; books: any[] } | null> {
  try {
    const response = await fetch(`${API_BASE}/isbndb/subject/${encodeURIComponent(subjectName)}`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching subject from ISBNdb:', error);
    throw error;
  }
}

/**
 * Get ISBNdb stats
 */
export async function getStats(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/isbndb/stats`, {
      headers: {
        ...moonHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`ISBNdb API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching stats from ISBNdb:', error);
    throw error;
  }
}