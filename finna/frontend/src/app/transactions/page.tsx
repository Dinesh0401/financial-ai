"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Upload } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";

gsap.registerPlugin(useGSAP);
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTransactionSummary, isAuthenticated, uploadTransactions } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { TransactionSummary } from "@/lib/types";

type UploadResult = {
  total_parsed: number;
  successful: number;
  failed: number;
  categories_assigned: Record<string, number>;
};

export default function TransactionsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getTransactionSummary();
      setSummary(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load transaction summary.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setUploadResult(null);
    setError("");

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfPassword("");
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setError("");
    setUploadResult(null);
    try {
      const result = await uploadTransactions(
        selectedFile,
        undefined,
        selectedFile.name.toLowerCase().endsWith(".pdf") ? pdfPassword : undefined,
      );
      setUploadResult(result);
      setSelectedFile(null);
      setPdfPassword("");
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleUpload();
  }

  const isPdf = selectedFile?.name.toLowerCase().endsWith(".pdf") ?? false;

  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!pageRef.current) return;
      const cards = pageRef.current.querySelectorAll("[data-animate='card']");
      if (cards.length === 0) return;
      gsap.fromTo(
        Array.from(cards),
        { autoAlpha: 0, y: 28, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" },
      );
    },
    { scope: pageRef },
  );

  return (
    <AppShell>
      <div ref={pageRef} className="space-y-6">
        <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Upload className="size-5 text-primary" />
              Upload bank statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload your bank statement (CSV, XLSX, or PDF) and the AI parser will automatically extract
                transactions, classify merchants, and detect recurring expenses.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.pdf"
                  onChange={handleFileSelection}
                  className="hidden"
                  id="statement-upload"
                />
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Parsing statement...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 size-4" />
                      Choose file
                    </>
                  )}
                </Button>
                <Button type="submit" variant="secondary" disabled={!selectedFile || uploading}>
                  {uploading ? "Uploading..." : "Upload statement"}
                </Button>
                <span className="text-xs text-muted-foreground">Supports CSV, XLSX, PDF up to 10MB</span>
              </div>

              {selectedFile && (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/30 p-4">
                  <p className="text-sm">
                    Selected file: <span className="font-medium">{selectedFile.name}</span>
                  </p>
                  {isPdf && (
                    <div className="space-y-2">
                      <label htmlFor="pdf-password" className="text-sm text-muted-foreground">
                        PDF password
                      </label>
                      <Input
                        id="pdf-password"
                        type="password"
                        placeholder="Enter PDF password if the statement is encrypted"
                        value={pdfPassword}
                        onChange={(event) => setPdfPassword(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Many e-statements are password-protected. Press Enter or use Upload statement after entering the password.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {uploadResult && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  <p className="font-medium">Upload complete</p>
                  <p className="mt-1">
                    Parsed {uploadResult.total_parsed} rows &mdash; {uploadResult.successful} transactions
                    imported, {uploadResult.failed} skipped.
                  </p>
                  {Object.keys(uploadResult.categories_assigned).length > 0 && (
                    <p className="mt-1">
                      Categories: {Object.entries(uploadResult.categories_assigned)
                        .map(([cat, count]) => `${cat.replaceAll("_", " ")} (${count})`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : summary ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl">Recurring and merchant concentration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.recurring_expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recurring expenses detected yet. Upload more statements and the parser will surface monthly patterns.
                  </p>
                ) : (
                  summary.recurring_expenses.map((item) => (
                    <div key={item.merchant} className="rounded-3xl border border-border/50 bg-background/30 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{item.merchant}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Detected as a {item.frequency} recurring expense.
                          </p>
                        </div>
                        <p className="text-sm text-primary">{formatCurrency(item.amount)}</p>
                      </div>
                    </div>
                  ))
                )}
                <div className="rounded-3xl border border-border/50 bg-background/30 p-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-primary">Category totals</p>
                  <div className="mt-4 grid gap-3">
                    {Object.entries(summary.category_totals).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No debits found yet.</p>
                    ) : (
                      Object.entries(summary.category_totals).map(([category, amount]) => (
                        <div key={category} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-muted-foreground">{category.replaceAll("_", " ")}</span>
                          <span>{formatCurrency(amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl">Top merchants</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Spend</TableHead>
                      <TableHead>Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.top_merchants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                          No merchants to show yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary.top_merchants.map((merchant) => (
                        <TableRow key={merchant.name}>
                          <TableCell>{merchant.name}</TableCell>
                          <TableCell>{formatCurrency(merchant.total)}</TableCell>
                          <TableCell>{merchant.count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
            <CardContent className="p-8 text-center">
              <FileUp className="mx-auto size-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">No transactions yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a bank statement above to get started. The AI agents will analyze your spending,
                classify merchants, and generate insights.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
