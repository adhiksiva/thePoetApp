import { ChangeDetectionStrategy, Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpClientModule } from '@angular/common/http';
import { catchError, map,forkJoin, of } from 'rxjs'; 

/**
 * Represents a single poem, and these are the values that'll be populated locally
 * from the API call
 */

interface Poem {
  title: string;
  author: string;
  lines: string[];
  linecount: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1 class="text-3xl font-bold text-indigo-600">The Poet: A Database Search</h1>
        <p class="text-gray-500 italic">Search titles and authors from the PoetryDB.</p>
      </header>

      <div class="search-section">
        <div class="search-input-group">
          <input
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            (keyup.enter)="executeSearch()"
            type="text"
            placeholder="Author or Title (e.g., Shakespeare or Raven)"
          />
          <button (click)="executeSearch()" [disabled]="!searchTerm() || isLoading()" title="Search">
            <span *ngIf="!isLoading()">Search</span>
            <span *ngIf="isLoading()" class="spinner"></span>
          </button>
        </div>
      </div>


      <div *ngIf="error()" class="error-message">
        <p class="font-semibold">Error:</p>
        <p>{{ error() }}</p>
      </div>

      <div *ngIf="!searchResults() && !error() && !isLoading()" class="initial-message">
        Start by typing an author or title above and pressing Search or Enter.
      </div>
    
      <div *ngIf="searchResults()?.length">
        <p class="results-meta-section">Found <span class="font-bold">{{ searchResults()?.length }}</span> {{ searchResults()?.length === 1 ? 'poem' : 'poems' }}</p>
        <div class="poem-results-grid">
          <div *ngFor="let poem of searchResults()" class="poem-card">
            <h2 class="text-xl font-semibold text-indigo-800">{{ poem.title }}</h2>
            <p class="text-sm text-gray-600">by {{ poem.author }}</p>
            <p class="text-xs text-gray-400">Lines: {{ poem.linecount }}</p>
            <pre class="poem-preview">{{ getPreview(poem.lines) }}</pre>
            <button (click)="showFullPoem(poem)" class="read-button">Read Full Poem</button>
          </div>
        </div>
      </div>


      <div *ngIf="selectedPoem()" class="modal-backdrop" (click)="selectedPoem.set(null)">
        <div class="poem-modal" (click)="$event.stopPropagation()">
          <h3 class="text-2xl font-bold mb-2">{{ selectedPoem()?.title }}</h3>
          <p class="text-md text-gray-600 mb-4">by {{ selectedPoem()?.author }}</p>
          <div class="poem-content-scroll">
            <pre class="whitespace-pre-wrap">{{ selectedPoem()?.lines?.join('\n') }}</pre>
          </div>
          <button (click)="selectedPoem.set(null)" class="close-button">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; background-color: #f7f7f7; min-height: 100vh; }
    .app-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      font-family: 'Inter', Arial, sans-serif;
    }
    .app-header {
      text-align: center;
      margin-bottom: 40px;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }
    .search-section {
      width: 100%;
      margin-bottom: 30px;
    }
    .search-input-group {
      display: flex;
      gap: 10px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.1);
      padding: 12px;
    }
    .search-input-group input {
      flex: 1;
      padding: 12px 18px;
      font-size: 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
      transition: border-color 0.2s;
    }
    .search-input-group input:focus {
      outline: none;
      border-color: #4f46e5;
    }
    .search-input-group button {
      padding: 12px 18px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 100px;
      transition: background-color 0.2s, transform 0.1s;
    }
    .search-input-group button:hover:not(:disabled) {
      background: #4338ca;
    }
    .search-input-group button:active:not(:disabled) {
      transform: scale(0.98);
    }
    .search-input-group button:disabled {
      background: #a5b4fc;
      cursor: not-allowed;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid white;
      border-top: 2px solid transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #fca5a5;
      margin-bottom: 20px;
    }
    .initial-message {
      text-align: center;
      color: #6b7280;
      padding: 40px;
      border: 1px dashed #d1d5db;
      border-radius: 8px;
    }
    .results-meta-section {
      margin-bottom: 20px;
      font-size: 1.1rem;
      color: #374151;
    }
    .poem-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .poem-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s;
    }
    .poem-card:hover {
        transform: translateY(-3px);
    }
    .poem-preview {
      max-height: 90px;
      overflow: hidden;
      white-space: pre-wrap;
      font-size: 0.9rem;
      color: #374151;
      margin-top: 10px;
      padding: 10px 0;
      border-top: 1px dashed #e5e7eb;
      margin-bottom: 15px;
    }
    .read-button {
        background: #93c5fd;
        color: #1e3a8a;
        padding: 8px 15px;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .read-button:hover {
        background: #60a5fa;
    }
   
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      animation: fadeIn 0.3s;
    }
    .poem-modal {
      background: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 700px;
      width: 90%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s;
    }
    .poem-content-scroll {
        overflow-y: auto;
        padding-right: 15px;
        margin-bottom: 20px;
    }
    .poem-modal pre {
        white-space: pre-wrap;
        font-family: inherit;
        font-size: 1rem;
        line-height: 1.6;
        color: #1f2937;
    }
    .close-button {
      align-self: flex-end;
      padding: 10px 20px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .close-button:hover {
        background: #dc2626;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateY(-50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  searchTerm = signal<string>('');
  searchResults = signal<Poem[] | null>(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  selectedPoem = signal<Poem | null>(null);

  private http = inject(HttpClient);

  /**
   * Handles the case where the response returned by the API call
   * is not an array or a 404 error, and no error is thrown consequently
   */
  private processResponse(res: any): Poem[] {
    if (Array.isArray(res)) {
        return res as Poem[];
    }
    if (res?.status === 404) {
        return [];
    }
    return [];
  }
  /**
   * Executes a single HTTP GET request to the PoetryDB URL.
   * In times of network failures, catchError is called and returns an empty array.
   */
  private getPoemSearch(url: string) {
    return this.http.get<Poem[] | { status: number, reason: string }>(url).pipe(
        map(res => this.processResponse(res)),
        catchError((err: HttpErrorResponse) => {
            alert(`Error during search for URL ${url}:`);
            return of([]);
        })
    );
  }
  /**
   * Initiates the search by fetching the term, clearing previous errors, and setting the loading state.
   * It performs two parallel searches (by author and title) using forkJoin, combines the results, and displays them.
   */
  executeSearch(): void {
    const term = this.searchTerm().trim();
    if (!term) {
        this.error.set('Please enter a search term.');
        console.warn('Search stopped: No term entered.');
        return;
    }

    this.error.set(null);
    this.searchResults.set(null);
    this.isLoading.set(true);

    const encodedTerm = encodeURIComponent(term);
    
    const authorSearchUrl = `https://poetrydb.org/author/${encodedTerm}`;
    const titleSearchUrl = `https://poetrydb.org/title/${encodedTerm}`;

    console.log('Author API URL:', authorSearchUrl);
    console.log('Title API URL:', titleSearchUrl);

    forkJoin([
      this.getPoemSearch(authorSearchUrl),
      this.getPoemSearch(titleSearchUrl)
    ]).subscribe({
      next: ([authorResults, titleResults]) => { 
        console.log('Subscription Next Success');
        let combinedResults = [...authorResults, ...titleResults];
        const uniqueResults = combinedResults.filter((poem, index, self) => 
            index === self.findIndex((t) => (
                t.title === poem.title && t.author === poem.author
            ))
        );

        this.searchResults.set(uniqueResults); 
        this.isLoading.set(false); 
        
        if (uniqueResults.length === 0) {
          this.error.set(`No poems found matching "${term}". Try a poet's name or poem title like "Shakespeare" or "Spring".`);
        } else {
            this.error.set(null);
        }
      },
      error: (e) => { 
        console.error('Fatal Subscription Error', e);
        this.error.set('An unexpected network error occurred.');
        this.isLoading.set(false); 
      }
    });
  }
  /**
   * Generates a short preview of the poem for display on the card.
   * It takes the first five lines of the poem and adds an ellipsis
   * if the full poem is longer than the preview.
   */
  getPreview(lines: string[]): string {
    const preview = lines.slice(0, 5).join('\n');
    return preview + (lines.length > 5 ? '\n...' : '');
  }
  /**
   * When triggered when the user clicks on a card, it sets the selectedPoem signal to the clicked poem
   * and the whole poem is displayed if it's longer than the preview
   *
   */
  showFullPoem(poem: Poem) { this.selectedPoem.set(poem); }
}
