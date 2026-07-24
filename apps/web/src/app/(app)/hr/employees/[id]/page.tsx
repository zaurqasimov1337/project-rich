'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calcAzPayroll } from '@edusphere/shared';
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ExternalLink,
  FileText,
  FolderOpen,
  Package,
  Pencil,
  Plus,
  Target,
  Trash2,
  Undo2,
  User,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, formatMoney, initials } from '@/lib/utils';
import {
  ASSET_CATEGORY_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  HR_STATUS_LABELS,
  REVIEW_TYPE_LABELS,
  MARITAL_STATUS_LABELS,
  SECTOR_LABELS,
  WORK_TYPE_LABELS,
} from '@/lib/hr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { DepartmentCascade, type DeptNode } from '@/components/department-cascade';

interface Contract {
  id: string;
  type: string;
  title: string;
  status: string;
  signedAt: string | null;
  expiresAt: string | null;
  note: string | null;
}

interface Asset {
  id: string;
  name: string;
  category: string | null;
  serial: string | null;
  givenAt: string | null;
  givenBy: string | null;
  returnedAt: string | null;
  note: string | null;
}

interface EmployeeDoc {
  id: string;
  type: string;
  title: string;
  fileUrl: string | null;
  status: string;
  acceptedAt: string | null;
  expiresAt: string | null;
  note: string | null;
}

interface Review {
  id: string;
  period: string;
  type: string;
  score: number | null;
  maxScore: number;
  summary: string | null;
  reviewerName: string | null;
}

interface Goal {
  id: string;
  title: string;
  metric: string | null;
  target: number | null;
  progress: number;
  dueAt: string | null;
  status: string;
}

interface SalaryChangeRow {
  id: string;
  oldQepik: number;
  newQepik: number;
  reason: string | null;
  approvedByName: string | null;
  effectiveAt: string;
}

interface Profile {
  id: string;
  position: string | null;
  contractType: string | null;
  salaryQepik: number;
  bonusQepik: number;
  note: string | null;
  hiredAt: string | null;
  firedAt: string | null;
  departmentId: string | null;
  employeeNo: string | null;
  pin: string | null;
  idCardNumber: string | null;
  birthDate: string | null;
  address: string | null;
  maritalStatus: string | null;
  emergencyContact: string | null;
  workType: string | null;
  hrStatus: string;
  managerId: string | null;
  sector: string;
  exemptionQepik: number;
  unionPct: number;
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null } | null;
  department: { id: string; name: string; kind: string } | null;
  manager: { id: string; name: string | null } | null;
  contracts: Contract[];
  assets: Asset[];
  documents: EmployeeDoc[];
  reviews: Review[];
  goals: Goal[];
  salaryChanges: SalaryChangeRow[];
  leave: { allowance: number; used: number; remaining: number };
  payroll: { netQepik: number; totalEmployerCost: number };
}

interface EmployeeListRow {
  id: string;
  user: { firstName: string; lastName: string } | null;
}

const dateInput = (v: string | null) => (v ? v.slice(0, 10) : '');
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString('az-Latn-AZ') : '—');

function Card({
  title,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

interface ContractForm {
  type: string;
  title: string;
  status: string;
  signedAt: string;
  expiresAt: string;
  note: string;
}

const EMPTY_CONTRACT: ContractForm = { type: 'emek', title: '', status: 'aktiv', signedAt: '', expiresAt: '', note: '' };

interface AssetForm {
  name: string;
  category: string;
  serial: string;
  givenAt: string;
  givenBy: string;
  returnedAt: string;
  note: string;
}

const EMPTY_ASSET: AssetForm = { name: '', category: 'texnika', serial: '', givenAt: '', givenBy: '', returnedAt: '', note: '' };

interface DocumentForm {
  type: string;
  title: string;
  fileUrl: string;
  status: string;
  expiresAt: string;
  note: string;
}

const EMPTY_DOCUMENT: DocumentForm = { type: 'sexsiyyet', title: '', fileUrl: '', status: 'yuklenib', expiresAt: '', note: '' };

interface GoalForm {
  title: string;
  metric: string;
  target: string;
  progress: string;
  dueAt: string;
  status: string;
}

const EMPTY_GOAL: GoalForm = { title: '', metric: '', target: '', progress: '0', dueAt: '', status: 'davam_edir' };

interface ReviewForm {
  period: string;
  type: string;
  score: string;
  maxScore: string;
  summary: string;
}

const EMPTY_REVIEW: ReviewForm = { period: '', type: 'manager', score: '', maxScore: '100', summary: '' };

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const canManage = can('hr.employees.manage');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['employee-profile', id],
    queryFn: () => api.get<Profile>(`/employees/${id}`),
    enabled: !!id,
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<DeptNode[]>('/departments'),
    enabled: canManage,
  });
  const { data: allEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<EmployeeListRow[]>('/employees'),
    enabled: canManage,
  });

  // ---- editable state, seeded from profile ----
  const [personal, setPersonal] = useState({
    pin: '', idCardNumber: '', birthDate: '', address: '', maritalStatus: '', emergencyContact: '', employeeNo: '',
  });
  const [work, setWork] = useState({
    hrStatus: 'aktiv', workType: '', departmentId: undefined as string | undefined,
    managerId: '', hiredAt: '', firedAt: '', sector: 'private_nonoil', exemptionAzn: '0', unionPct: '0', position: '',
  });
  const [salary, setSalary] = useState({ salaryAzn: '0', bonusAzn: '0', reason: '' });

  useEffect(() => {
    if (!profile) return;
    setPersonal({
      pin: profile.pin ?? '',
      idCardNumber: profile.idCardNumber ?? '',
      birthDate: dateInput(profile.birthDate),
      address: profile.address ?? '',
      maritalStatus: profile.maritalStatus ?? '',
      emergencyContact: profile.emergencyContact ?? '',
      employeeNo: profile.employeeNo ?? '',
    });
    setWork({
      hrStatus: profile.hrStatus,
      workType: profile.workType ?? '',
      departmentId: profile.departmentId ?? undefined,
      managerId: profile.managerId ?? '',
      hiredAt: dateInput(profile.hiredAt),
      firedAt: dateInput(profile.firedAt),
      sector: profile.sector,
      exemptionAzn: String(profile.exemptionQepik / 100),
      unionPct: String(profile.unionPct),
      position: profile.position ?? '',
    });
    setSalary({
      salaryAzn: String(profile.salaryQepik / 100),
      bonusAzn: String(profile.bonusQepik / 100),
      reason: '',
    });
  }, [profile]);

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/employees/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const savePersonal = () =>
    patchMutation.mutate({
      pin: personal.pin || undefined,
      idCardNumber: personal.idCardNumber || undefined,
      birthDate: personal.birthDate || undefined,
      address: personal.address || undefined,
      maritalStatus: personal.maritalStatus || undefined,
      emergencyContact: personal.emergencyContact || undefined,
      employeeNo: personal.employeeNo || undefined,
    });

  const saveWork = () =>
    patchMutation.mutate({
      hrStatus: work.hrStatus,
      workType: work.workType || undefined,
      departmentId: work.departmentId,
      managerId: work.managerId || undefined,
      hiredAt: work.hiredAt || undefined,
      firedAt: work.firedAt || undefined,
      sector: work.sector,
      exemptionQepik: Math.round(Number(work.exemptionAzn || 0) * 100),
      unionPct: Number(work.unionPct || 0),
      position: work.position || undefined,
    });

  const saveSalary = () =>
    patchMutation.mutate({
      salaryQepik: Math.round(Number(salary.salaryAzn || 0) * 100),
      bonusQepik: Math.round(Number(salary.bonusAzn || 0) * 100),
      salaryChangeReason: salary.reason || undefined,
    });

  // ---- contracts ----
  const [contractModal, setContractModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [contractForm, setContractForm] = useState<ContractForm>(EMPTY_CONTRACT);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);

  const contractSave = useMutation({
    mutationFn: () => {
      const body = {
        type: contractForm.type,
        title: contractForm.title.trim(),
        status: contractForm.status,
        signedAt: contractForm.signedAt || undefined,
        expiresAt: contractForm.expiresAt || undefined,
        note: contractForm.note || undefined,
      };
      return contractModal.editId
        ? api.patch(`/employee-contracts/${contractModal.editId}`, body)
        : api.post(`/employees/${id}/contracts`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setContractModal({ open: false, editId: null });
    },
  });
  const contractDelete = useMutation({
    mutationFn: (cid: string) => api.delete(`/employee-contracts/${cid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setDeleteContractId(null);
    },
  });

  const openNewContract = () => {
    setContractForm(EMPTY_CONTRACT);
    setContractModal({ open: true, editId: null });
  };
  const openEditContract = (c: Contract) => {
    setContractForm({
      type: c.type,
      title: c.title,
      status: c.status,
      signedAt: dateInput(c.signedAt),
      expiresAt: dateInput(c.expiresAt),
      note: c.note ?? '',
    });
    setContractModal({ open: true, editId: c.id });
  };

  // ---- assets ----
  const [assetModal, setAssetModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [assetForm, setAssetForm] = useState<AssetForm>(EMPTY_ASSET);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);

  const assetSave = useMutation({
    mutationFn: () => {
      const body = {
        name: assetForm.name.trim(),
        category: assetForm.category || undefined,
        serial: assetForm.serial || undefined,
        givenAt: assetForm.givenAt || undefined,
        givenBy: assetForm.givenBy || undefined,
        returnedAt: assetForm.returnedAt || undefined,
        note: assetForm.note || undefined,
      };
      return assetModal.editId
        ? api.patch(`/employee-assets/${assetModal.editId}`, body)
        : api.post(`/employees/${id}/assets`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setAssetModal({ open: false, editId: null });
    },
  });
  const assetReturn = useMutation({
    mutationFn: (aid: string) =>
      api.patch(`/employee-assets/${aid}`, { returnedAt: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['employee-profile', id] }),
  });
  const assetDelete = useMutation({
    mutationFn: (aid: string) => api.delete(`/employee-assets/${aid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setDeleteAssetId(null);
    },
  });

  const openNewAsset = () => {
    setAssetForm(EMPTY_ASSET);
    setAssetModal({ open: true, editId: null });
  };
  const openEditAsset = (a: Asset) => {
    setAssetForm({
      name: a.name,
      category: a.category ?? 'diger',
      serial: a.serial ?? '',
      givenAt: dateInput(a.givenAt),
      givenBy: a.givenBy ?? '',
      returnedAt: dateInput(a.returnedAt),
      note: a.note ?? '',
    });
    setAssetModal({ open: true, editId: a.id });
  };

  // ---- documents ----
  const [docModal, setDocModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [docForm, setDocForm] = useState<DocumentForm>(EMPTY_DOCUMENT);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const docSave = useMutation({
    mutationFn: () => {
      const body = {
        type: docForm.type,
        title: docForm.title.trim(),
        fileUrl: docForm.fileUrl.trim() || undefined,
        status: docForm.status,
        expiresAt: docForm.expiresAt || undefined,
        note: docForm.note || undefined,
      };
      return docModal.editId
        ? api.patch(`/employee-documents/${docModal.editId}`, body)
        : api.post(`/employees/${id}/documents`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      void qc.invalidateQueries({ queryKey: ['hr-dashboard'] });
      setDocModal({ open: false, editId: null });
    },
  });
  const docDelete = useMutation({
    mutationFn: (did: string) => api.delete(`/employee-documents/${did}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setDeleteDocId(null);
    },
  });

  const openNewDoc = () => {
    setDocForm(EMPTY_DOCUMENT);
    setDocModal({ open: true, editId: null });
  };
  const openEditDoc = (d: EmployeeDoc) => {
    setDocForm({
      type: d.type,
      title: d.title,
      fileUrl: d.fileUrl ?? '',
      status: d.status,
      expiresAt: dateInput(d.expiresAt),
      note: d.note ?? '',
    });
    setDocModal({ open: true, editId: d.id });
  };

  // ---- performance goals ----
  const [goalModal, setGoalModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [goalForm, setGoalForm] = useState<GoalForm>(EMPTY_GOAL);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  const goalSave = useMutation({
    mutationFn: () => {
      const body = {
        title: goalForm.title.trim(),
        metric: goalForm.metric.trim() || undefined,
        target: goalForm.target === '' ? undefined : Number(goalForm.target),
        progress: Math.min(100, Math.max(0, Number(goalForm.progress || 0))),
        dueAt: goalForm.dueAt || undefined,
        status: goalForm.status,
      };
      return goalModal.editId
        ? api.patch(`/performance-goals/${goalModal.editId}`, body)
        : api.post(`/employees/${id}/goals`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setGoalModal({ open: false, editId: null });
    },
  });
  const goalDelete = useMutation({
    mutationFn: (gid: string) => api.delete(`/performance-goals/${gid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setDeleteGoalId(null);
    },
  });

  const openNewGoal = () => {
    setGoalForm(EMPTY_GOAL);
    setGoalModal({ open: true, editId: null });
  };
  const openEditGoal = (g: Goal) => {
    setGoalForm({
      title: g.title,
      metric: g.metric ?? '',
      target: g.target !== null ? String(g.target) : '',
      progress: String(g.progress),
      dueAt: dateInput(g.dueAt),
      status: g.status,
    });
    setGoalModal({ open: true, editId: g.id });
  };

  // ---- performance reviews ----
  const [reviewModal, setReviewModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [reviewForm, setReviewForm] = useState<ReviewForm>(EMPTY_REVIEW);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);

  const reviewSave = useMutation({
    mutationFn: () => {
      const body = {
        period: reviewForm.period.trim(),
        type: reviewForm.type,
        score: reviewForm.score === '' ? undefined : Number(reviewForm.score),
        maxScore: reviewForm.maxScore === '' ? undefined : Number(reviewForm.maxScore),
        summary: reviewForm.summary.trim() || undefined,
      };
      return reviewModal.editId
        ? api.patch(`/performance-reviews/${reviewModal.editId}`, body)
        : api.post(`/employees/${id}/reviews`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setReviewModal({ open: false, editId: null });
    },
  });
  const reviewDelete = useMutation({
    mutationFn: (rid: string) => api.delete(`/performance-reviews/${rid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee-profile', id] });
      setDeleteReviewId(null);
    },
  });

  const openNewReview = () => {
    setReviewForm(EMPTY_REVIEW);
    setReviewModal({ open: true, editId: null });
  };
  const openEditReview = (r: Review) => {
    setReviewForm({
      period: r.period,
      type: r.type,
      score: r.score !== null ? String(r.score) : '',
      maxScore: String(r.maxScore),
      summary: r.summary ?? '',
    });
    setReviewModal({ open: true, editId: r.id });
  };

  // ---- live payroll breakdown (client-side, same formula as server) ----
  const grossQepik = Math.round(Number(salary.salaryAzn || 0) * 100) + Math.round(Number(salary.bonusAzn || 0) * 100);
  const breakdown = calcAzPayroll({
    grossQepik,
    sector: work.sector === 'state_oil' ? 'state_oil' : 'private_nonoil',
    exemptionQepik: Math.round(Number(work.exemptionAzn || 0) * 100),
    unionPct: Number(work.unionPct || 0),
  });

  if (isLoading || !profile) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted-bg" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted-bg" />
          ))}
        </div>
      </div>
    );
  }

  const st = HR_STATUS_LABELS[profile.hrStatus] ?? { label: profile.hrStatus, tone: 'neutral' as const };
  const fullName = profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : '—';
  const DAY = 24 * 60 * 60 * 1000;
  const contractUrgency = (c: Contract): 'red' | 'amber' | null => {
    if (!c.expiresAt || c.status === 'bitib' || c.status === 'legv') return null;
    const d = Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / DAY);
    if (d < 0) return null;
    if (d <= 7) return 'red';
    if (d <= 30) return 'amber';
    return null;
  };

  return (
    <div className="space-y-5">
      <Link href="/hr/employees" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> İşçilər
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
          {initials(profile.user?.firstName, profile.user?.lastName)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{fullName}</h1>
            <Badge tone={st.tone} dot>{st.label}</Badge>
            {profile.employeeNo && <Badge tone="neutral">№ {profile.employeeNo}</Badge>}
          </div>
          <p className="text-sm text-muted">
            {profile.position ?? '—'}
            {profile.department ? ` · ${profile.department.name}` : ''}
          </p>
        </div>
      </div>

      {patchMutation.isError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {(patchMutation.error as Error).message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Şəxsi məlumatlar */}
        <Card
          title="Şəxsi məlumatlar"
          icon={User}
          actions={
            canManage && (
              <Button size="sm" variant="outline" loading={patchMutation.isPending} onClick={savePersonal}>
                Yadda saxla
              </Button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>FİN</Label>
              <Input value={personal.pin} maxLength={20} disabled={!canManage}
                onChange={(e) => setPersonal({ ...personal, pin: e.target.value })} />
            </div>
            <div>
              <Label>Ş/V nömrəsi</Label>
              <Input value={personal.idCardNumber} maxLength={30} disabled={!canManage}
                onChange={(e) => setPersonal({ ...personal, idCardNumber: e.target.value })} />
            </div>
            <div>
              <Label>Doğum tarixi</Label>
              <Input type="date" value={personal.birthDate} disabled={!canManage}
                onChange={(e) => setPersonal({ ...personal, birthDate: e.target.value })} />
            </div>
            <div>
              <Label>Tabel №</Label>
              <Input value={personal.employeeNo} maxLength={40} disabled={!canManage}
                onChange={(e) => setPersonal({ ...personal, employeeNo: e.target.value })} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={profile.user?.phone ?? ''} disabled placeholder="—" />
            </div>
            <div>
              <Label>E-poçt</Label>
              <Input value={profile.user?.email ?? ''} disabled placeholder="—" />
            </div>
            <div className="sm:col-span-2">
              <Label>Ünvan</Label>
              <Input value={personal.address} maxLength={300} disabled={!canManage}
                onChange={(e) => setPersonal({ ...personal, address: e.target.value })} />
            </div>
            <div>
              <Label>Ailə vəziyyəti</Label>
              <Select
                placeholder="Seçin"
                value={personal.maritalStatus}
                disabled={!canManage}
                onChange={(e) => setPersonal({ ...personal, maritalStatus: e.target.value })}
                options={Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div>
              <Label>Təcili əlaqə</Label>
              <Input value={personal.emergencyContact} maxLength={200} disabled={!canManage}
                placeholder="Ad, telefon"
                onChange={(e) => setPersonal({ ...personal, emergencyContact: e.target.value })} />
            </div>
          </div>
        </Card>

        {/* İş məlumatları */}
        <Card
          title="İş məlumatları"
          icon={Briefcase}
          actions={
            canManage && (
              <Button size="sm" variant="outline" loading={patchMutation.isPending} onClick={saveWork}>
                Yadda saxla
              </Button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Vəzifə</Label>
              <Input value={work.position} maxLength={80} disabled={!canManage}
                onChange={(e) => setWork({ ...work, position: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={work.hrStatus}
                disabled={!canManage}
                onChange={(e) => setWork({ ...work, hrStatus: e.target.value })}
                options={Object.entries(HR_STATUS_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
            <div>
              <Label>İş növü</Label>
              <Select
                placeholder="Seçin"
                value={work.workType}
                disabled={!canManage}
                onChange={(e) => setWork({ ...work, workType: e.target.value })}
                options={Object.entries(WORK_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div>
              <Label>Rəhbər</Label>
              <Select
                placeholder="Seçin"
                value={work.managerId}
                disabled={!canManage}
                onChange={(e) => setWork({ ...work, managerId: e.target.value })}
                options={(allEmployees ?? [])
                  .filter((e) => e.id !== id)
                  .map((e) => ({
                    value: e.id,
                    label: e.user ? `${e.user.firstName} ${e.user.lastName}` : e.id,
                  }))}
              />
            </div>
            <div className="sm:col-span-2">
              <DepartmentCascade
                departments={departments ?? []}
                value={work.departmentId}
                onChange={(departmentId) => setWork({ ...work, departmentId })}
                disabled={!canManage}
              />
            </div>
            <div>
              <Label>İşə qəbul</Label>
              <Input type="date" value={work.hiredAt} disabled={!canManage}
                onChange={(e) => setWork({ ...work, hiredAt: e.target.value })} />
            </div>
            <div>
              <Label>Çıxış tarixi</Label>
              <Input type="date" value={work.firedAt} disabled={!canManage}
                onChange={(e) => setWork({ ...work, firedAt: e.target.value })} />
            </div>
            <div>
              <Label>Sektor</Label>
              <Select
                value={work.sector}
                disabled={!canManage}
                onChange={(e) => setWork({ ...work, sector: e.target.value })}
                options={Object.entries(SECTOR_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Güzəşt (₼)</Label>
                <Input type="number" min={0} step="0.01" value={work.exemptionAzn} disabled={!canManage}
                  onChange={(e) => setWork({ ...work, exemptionAzn: e.target.value })} />
              </div>
              <div>
                <Label>Həmkarlar (%)</Label>
                <Input type="number" min={0} step="0.1" value={work.unionPct} disabled={!canManage}
                  onChange={(e) => setWork({ ...work, unionPct: e.target.value })} />
              </div>
            </div>
          </div>
        </Card>

        {/* Maaş */}
        <Card
          title="Maaş"
          icon={Wallet}
          actions={
            canManage && (
              <Button size="sm" variant="outline" loading={patchMutation.isPending} onClick={saveSalary}>
                Yadda saxla
              </Button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Əsas maaş (₼)</Label>
              <Input type="number" min={0} step="0.01" value={salary.salaryAzn} disabled={!canManage}
                onChange={(e) => setSalary({ ...salary, salaryAzn: e.target.value })} />
            </div>
            <div>
              <Label>Bonus (₼)</Label>
              <Input type="number" min={0} step="0.01" value={salary.bonusAzn} disabled={!canManage}
                onChange={(e) => setSalary({ ...salary, bonusAzn: e.target.value })} />
            </div>
            <div>
              <Label>Dəyişiklik səbəbi</Label>
              <Input value={salary.reason} maxLength={300} disabled={!canManage} placeholder="Könüllü"
                onChange={(e) => setSalary({ ...salary, reason: e.target.value })} />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">Gross (əsas + bonus)</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(breakdown.grossQepik)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">Gəlir vergisi</td>
                  <td className="px-3 py-2 text-right tabular-nums text-danger">−{formatMoney(breakdown.incomeTax)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">DSMF (işçi)</td>
                  <td className="px-3 py-2 text-right tabular-nums text-danger">−{formatMoney(breakdown.dsmfEmployee)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">İşsizlik sığortası</td>
                  <td className="px-3 py-2 text-right tabular-nums text-danger">−{formatMoney(breakdown.unemploymentEmployee)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">İcbari tibbi sığorta</td>
                  <td className="px-3 py-2 text-right tabular-nums text-danger">−{formatMoney(breakdown.healthEmployee)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">Həmkarlar haqqı</td>
                  <td className="px-3 py-2 text-right tabular-nums text-danger">−{formatMoney(breakdown.unionFee)}</td>
                </tr>
                <tr className="border-b border-border bg-success/5">
                  <td className="px-3 py-2 font-bold">İşçiyə çatan</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-success">{formatMoney(breakdown.netQepik)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-bold">İşəgötürənə cəmi</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{formatMoney(breakdown.totalEmployerCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Maaş tarixçəsi</h4>
            <div className="mt-2 space-y-2">
              {profile.salaryChanges.length === 0 && (
                <p className="text-sm text-muted">Dəyişiklik qeydə alınmayıb.</p>
              )}
              {profile.salaryChanges.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="tabular-nums">
                    {formatMoney(s.oldQepik)} → <span className="font-semibold">{formatMoney(s.newQepik)}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {fmtDate(s.effectiveAt)}
                    {s.reason ? ` · ${s.reason}` : ''}
                    {s.approvedByName ? ` · ${s.approvedByName}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Performans */}
        <Card title="Performans" icon={Target}>
          {/* goals */}
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Məqsədlər</h4>
            {canManage && (
              <Button size="sm" variant="outline" onClick={openNewGoal}>
                <Plus className="h-4 w-4" /> Məqsəd
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {profile.goals.length === 0 && (
              <p className="text-sm text-muted">Məqsəd əlavə olunmayıb.</p>
            )}
            {profile.goals.map((g) => {
              const gs = GOAL_STATUS_LABELS[g.status] ?? { label: g.status, tone: 'neutral' as const };
              const pct = Math.min(100, Math.max(0, g.progress));
              return (
                <div key={g.id} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{g.title}</span>
                      <Badge tone={gs.tone}>{gs.label}</Badge>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Redaktə et" onClick={() => openEditGoal(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => setDeleteGoalId(g.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted-bg">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-muted">{pct}%</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {g.metric ? `${g.metric}${g.target !== null ? `: hədəf ${g.target}` : ''}` : ''}
                    {g.dueAt ? `${g.metric ? ' · ' : ''}Son tarix: ${fmtDate(g.dueAt)}` : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* reviews */}
          <div className="mb-2 mt-5 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Qiymətləndirmələr</h4>
            {canManage && (
              <Button size="sm" variant="outline" onClick={openNewReview}>
                <Plus className="h-4 w-4" /> Qiymətləndirmə
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {profile.reviews.length === 0 && (
              <p className="text-sm text-muted">Qiymətləndirmə əlavə olunmayıb.</p>
            )}
            {profile.reviews.map((r) => {
              const rt = REVIEW_TYPE_LABELS[r.type] ?? { label: r.type, tone: 'neutral' as const };
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{r.period}</span>
                      <Badge tone={rt.tone}>{rt.label}</Badge>
                      {r.score !== null && (
                        <span className="text-sm font-semibold tabular-nums text-primary">
                          {r.score}/{r.maxScore}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {r.reviewerName ? `Qiymətləndirən: ${r.reviewerName}` : ''}
                      {r.summary ? `${r.reviewerName ? ' · ' : ''}${r.summary}` : ''}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label="Redaktə et" onClick={() => openEditReview(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => setDeleteReviewId(r.id)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Müqavilələr */}
          <Card
            title="Müqavilələr"
            icon={FileText}
            actions={
              canManage && (
                <Button size="sm" onClick={openNewContract}>
                  <Plus className="h-4 w-4" /> Əlavə et
                </Button>
              )
            }
          >
            <div className="space-y-2">
              {profile.contracts.length === 0 && (
                <p className="text-sm text-muted">Müqavilə əlavə olunmayıb.</p>
              )}
              {profile.contracts.map((c) => {
                const cs = CONTRACT_STATUS_LABELS[c.status] ?? { label: c.status, tone: 'neutral' as const };
                const urgency = contractUrgency(c);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2',
                      urgency === 'red' && 'border-danger/50 bg-danger/5',
                      urgency === 'amber' && 'border-warning/50 bg-warning/5',
                      !urgency && 'border-border',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{c.title}</span>
                        <Badge tone={cs.tone}>{cs.label}</Badge>
                      </div>
                      <div className="text-xs text-muted">
                        {CONTRACT_TYPE_LABELS[c.type] ?? c.type}
                        {c.signedAt ? ` · İmza: ${fmtDate(c.signedAt)}` : ''}
                        {c.expiresAt ? ` · Bitmə: ${fmtDate(c.expiresAt)}` : ''}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Redaktə et" onClick={() => openEditContract(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => setDeleteContractId(c.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Avadanlıqlar */}
          <Card
            title="Avadanlıqlar"
            icon={Package}
            actions={
              canManage && (
                <Button size="sm" onClick={openNewAsset}>
                  <Plus className="h-4 w-4" /> Əlavə et
                </Button>
              )
            }
          >
            <div className="space-y-2">
              {profile.assets.length === 0 && (
                <p className="text-sm text-muted">Avadanlıq əlavə olunmayıb.</p>
              )}
              {profile.assets.map((a) => {
                const cat = a.category
                  ? (ASSET_CATEGORY_LABELS[a.category] ?? { label: a.category, tone: 'neutral' as const })
                  : null;
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{a.name}</span>
                        {cat && <Badge tone={cat.tone}>{cat.label}</Badge>}
                        {a.returnedAt ? (
                          <Badge tone="neutral">Qaytarılıb · {fmtDate(a.returnedAt)}</Badge>
                        ) : (
                          <Badge tone="success">İstifadədə</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {a.serial ? `S/N: ${a.serial}` : ''}
                        {a.givenAt ? `${a.serial ? ' · ' : ''}Verilib: ${fmtDate(a.givenAt)}` : ''}
                        {a.givenBy ? ` · ${a.givenBy}` : ''}
                        {a.note ? ` · ${a.note}` : ''}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        {!a.returnedAt && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Qaytarıldı kimi işarələ"
                            title="Qaytarıldı kimi işarələ"
                            onClick={() => assetReturn.mutate(a.id)}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" aria-label="Redaktə et" onClick={() => openEditAsset(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => setDeleteAssetId(a.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Sənədlər */}
          <Card
            title="Sənədlər"
            icon={FolderOpen}
            actions={
              canManage && (
                <Button size="sm" onClick={openNewDoc}>
                  <Plus className="h-4 w-4" /> Əlavə et
                </Button>
              )
            }
          >
            <div className="space-y-2">
              {profile.documents.length === 0 && (
                <p className="text-sm text-muted">Sənəd əlavə olunmayıb.</p>
              )}
              {profile.documents.map((d) => {
                const dt = DOCUMENT_TYPE_LABELS[d.type] ?? { label: d.type, tone: 'neutral' as const };
                const ds = DOCUMENT_STATUS_LABELS[d.status] ?? { label: d.status, tone: 'neutral' as const };
                const daysToExpiry = d.expiresAt
                  ? Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / DAY)
                  : null;
                const expSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30 && d.status !== 'bitib';
                return (
                  <div
                    key={d.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2',
                      expSoon ? 'border-warning/50 bg-warning/5' : 'border-border',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{d.title}</span>
                        <Badge tone={dt.tone}>{dt.label}</Badge>
                        <Badge tone={ds.tone}>{ds.label}</Badge>
                        {d.fileUrl && (
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Fayl
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {d.expiresAt ? (
                          <span className={cn(expSoon && 'font-semibold text-warning')}>
                            Bitmə: {fmtDate(d.expiresAt)}
                            {expSoon && ` · ${daysToExpiry} gün qalıb`}
                          </span>
                        ) : (
                          'Bitmə tarixi yoxdur'
                        )}
                        {d.note ? ` · ${d.note}` : ''}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Redaktə et" onClick={() => openEditDoc(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => setDeleteDocId(d.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Məzuniyyət */}
          <Card title="Məzuniyyət" icon={CalendarDays}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted-bg/60 p-3">
                <div className="text-2xl font-bold tabular-nums">{profile.leave.allowance}</div>
                <div className="text-xs text-muted">Balans (gün)</div>
              </div>
              <div className="rounded-lg bg-warning/10 p-3">
                <div className="text-2xl font-bold tabular-nums text-warning">{profile.leave.used}</div>
                <div className="text-xs text-muted">İstifadə</div>
              </div>
              <div className="rounded-lg bg-success/10 p-3">
                <div className="text-2xl font-bold tabular-nums text-success">{profile.leave.remaining}</div>
                <div className="text-xs text-muted">Qalıq</div>
              </div>
            </div>
            <Link href="/hr/leave" className="mt-3 inline-block text-sm text-primary hover:underline">
              Məzuniyyət sorğuları →
            </Link>
          </Card>
        </div>
      </div>

      {/* contract modal */}
      <Modal
        open={contractModal.open}
        onClose={() => setContractModal({ open: false, editId: null })}
        title={contractModal.editId ? 'Müqaviləni redaktə et' : 'Yeni müqavilə'}
        footer={
          <>
            <Button variant="outline" onClick={() => setContractModal({ open: false, editId: null })}>
              Ləğv et
            </Button>
            <Button
              loading={contractSave.isPending}
              disabled={!contractForm.title.trim()}
              onClick={() => contractSave.mutate()}
            >
              Yadda saxla
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {contractSave.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(contractSave.error as Error).message}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Növ</Label>
              <Select
                value={contractForm.type}
                onChange={(e) => setContractForm({ ...contractForm, type: e.target.value })}
                options={Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={contractForm.status}
                onChange={(e) => setContractForm({ ...contractForm, status: e.target.value })}
                options={Object.entries(CONTRACT_STATUS_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
          </div>
          <div>
            <Label>Başlıq *</Label>
            <Input value={contractForm.title} maxLength={200}
              onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>İmza tarixi</Label>
              <Input type="date" value={contractForm.signedAt}
                onChange={(e) => setContractForm({ ...contractForm, signedAt: e.target.value })} />
            </div>
            <div>
              <Label>Bitmə tarixi</Label>
              <Input type="date" value={contractForm.expiresAt}
                onChange={(e) => setContractForm({ ...contractForm, expiresAt: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Qeyd</Label>
            <Input value={contractForm.note} maxLength={500}
              onChange={(e) => setContractForm({ ...contractForm, note: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteContractId}
        onClose={() => setDeleteContractId(null)}
        onConfirm={() => deleteContractId && contractDelete.mutate(deleteContractId)}
        title="Müqaviləni sil?"
        description="Bu əməliyyat geri qaytarıla bilməz."
        destructive
        loading={contractDelete.isPending}
      />

      {/* asset modal */}
      <Modal
        open={assetModal.open}
        onClose={() => setAssetModal({ open: false, editId: null })}
        title={assetModal.editId ? 'Avadanlığı redaktə et' : 'Yeni avadanlıq'}
        footer={
          <>
            <Button variant="outline" onClick={() => setAssetModal({ open: false, editId: null })}>
              Ləğv et
            </Button>
            <Button
              loading={assetSave.isPending}
              disabled={!assetForm.name.trim()}
              onClick={() => assetSave.mutate()}
            >
              Yadda saxla
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {assetSave.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(assetSave.error as Error).message}
            </div>
          )}
          <div>
            <Label>Ad *</Label>
            <Input value={assetForm.name} maxLength={200} placeholder="MacBook Pro 14"
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Kateqoriya</Label>
              <Select
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                options={Object.entries(ASSET_CATEGORY_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
            <div>
              <Label>Seriya nömrəsi</Label>
              <Input value={assetForm.serial} maxLength={120}
                onChange={(e) => setAssetForm({ ...assetForm, serial: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Verilmə tarixi</Label>
              <Input type="date" value={assetForm.givenAt}
                onChange={(e) => setAssetForm({ ...assetForm, givenAt: e.target.value })} />
            </div>
            <div>
              <Label>Kim verib</Label>
              <Input value={assetForm.givenBy} maxLength={120}
                onChange={(e) => setAssetForm({ ...assetForm, givenBy: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Qaytarılma tarixi</Label>
              <Input type="date" value={assetForm.returnedAt}
                onChange={(e) => setAssetForm({ ...assetForm, returnedAt: e.target.value })} />
            </div>
            <div>
              <Label>Qeyd</Label>
              <Input value={assetForm.note} maxLength={500}
                onChange={(e) => setAssetForm({ ...assetForm, note: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteAssetId}
        onClose={() => setDeleteAssetId(null)}
        onConfirm={() => deleteAssetId && assetDelete.mutate(deleteAssetId)}
        title="Avadanlığı sil?"
        description="Bu əməliyyat geri qaytarıla bilməz."
        destructive
        loading={assetDelete.isPending}
      />

      {/* document modal */}
      <Modal
        open={docModal.open}
        onClose={() => setDocModal({ open: false, editId: null })}
        title={docModal.editId ? 'Sənədi redaktə et' : 'Yeni sənəd'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDocModal({ open: false, editId: null })}>
              Ləğv et
            </Button>
            <Button
              loading={docSave.isPending}
              disabled={!docForm.title.trim()}
              onClick={() => docSave.mutate()}
            >
              Yadda saxla
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {docSave.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(docSave.error as Error).message}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Növ</Label>
              <Select
                value={docForm.type}
                onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                options={Object.entries(DOCUMENT_TYPE_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={docForm.status}
                onChange={(e) => setDocForm({ ...docForm, status: e.target.value })}
                options={Object.entries(DOCUMENT_STATUS_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
          </div>
          <div>
            <Label>Başlıq *</Label>
            <Input value={docForm.title} maxLength={200}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} />
          </div>
          <div>
            <Label>Fayl linki (URL)</Label>
            <Input value={docForm.fileUrl} maxLength={1000} placeholder="https://..."
              onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Bitmə tarixi</Label>
              <Input type="date" value={docForm.expiresAt}
                onChange={(e) => setDocForm({ ...docForm, expiresAt: e.target.value })} />
            </div>
            <div>
              <Label>Qeyd</Label>
              <Input value={docForm.note} maxLength={500}
                onChange={(e) => setDocForm({ ...docForm, note: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteDocId}
        onClose={() => setDeleteDocId(null)}
        onConfirm={() => deleteDocId && docDelete.mutate(deleteDocId)}
        title="Sənədi sil?"
        description="Bu əməliyyat geri qaytarıla bilməz."
        destructive
        loading={docDelete.isPending}
      />

      {/* goal modal */}
      <Modal
        open={goalModal.open}
        onClose={() => setGoalModal({ open: false, editId: null })}
        title={goalModal.editId ? 'Məqsədi redaktə et' : 'Yeni məqsəd'}
        footer={
          <>
            <Button variant="outline" onClick={() => setGoalModal({ open: false, editId: null })}>
              Ləğv et
            </Button>
            <Button
              loading={goalSave.isPending}
              disabled={!goalForm.title.trim()}
              onClick={() => goalSave.mutate()}
            >
              Yadda saxla
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {goalSave.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(goalSave.error as Error).message}
            </div>
          )}
          <div>
            <Label>Başlıq *</Label>
            <Input value={goalForm.title} maxLength={200} placeholder="Q3 satış hədəfi"
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Metrika</Label>
              <Input value={goalForm.metric} maxLength={120} placeholder="Yeni tələbə sayı"
                onChange={(e) => setGoalForm({ ...goalForm, metric: e.target.value })} />
            </div>
            <div>
              <Label>Hədəf dəyəri</Label>
              <Input type="number" step="0.01" value={goalForm.target}
                onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>İrəliləyiş (%)</Label>
              <Input type="number" min={0} max={100} value={goalForm.progress}
                onChange={(e) => setGoalForm({ ...goalForm, progress: e.target.value })} />
            </div>
            <div>
              <Label>Son tarix</Label>
              <Input type="date" value={goalForm.dueAt}
                onChange={(e) => setGoalForm({ ...goalForm, dueAt: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={goalForm.status}
                onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value })}
                options={Object.entries(GOAL_STATUS_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteGoalId}
        onClose={() => setDeleteGoalId(null)}
        onConfirm={() => deleteGoalId && goalDelete.mutate(deleteGoalId)}
        title="Məqsədi sil?"
        description="Bu əməliyyat geri qaytarıla bilməz."
        destructive
        loading={goalDelete.isPending}
      />

      {/* review modal */}
      <Modal
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false, editId: null })}
        title={reviewModal.editId ? 'Qiymətləndirməni redaktə et' : 'Yeni qiymətləndirmə'}
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewModal({ open: false, editId: null })}>
              Ləğv et
            </Button>
            <Button
              loading={reviewSave.isPending}
              disabled={!reviewForm.period.trim()}
              onClick={() => reviewSave.mutate()}
            >
              Yadda saxla
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {reviewSave.isError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {(reviewSave.error as Error).message}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Dövr *</Label>
              <Input value={reviewForm.period} maxLength={20} placeholder="2026-Q3"
                onChange={(e) => setReviewForm({ ...reviewForm, period: e.target.value })} />
            </div>
            <div>
              <Label>Növ</Label>
              <Select
                value={reviewForm.type}
                onChange={(e) => setReviewForm({ ...reviewForm, type: e.target.value })}
                options={Object.entries(REVIEW_TYPE_LABELS).map(([value, v]) => ({ value, label: v.label }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Bal</Label>
              <Input type="number" min={0} step="0.1" value={reviewForm.score}
                onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })} />
            </div>
            <div>
              <Label>Maksimum bal</Label>
              <Input type="number" min={1} step="0.1" value={reviewForm.maxScore}
                onChange={(e) => setReviewForm({ ...reviewForm, maxScore: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Xülasə</Label>
            <Input value={reviewForm.summary} maxLength={2000}
              onChange={(e) => setReviewForm({ ...reviewForm, summary: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteReviewId}
        onClose={() => setDeleteReviewId(null)}
        onConfirm={() => deleteReviewId && reviewDelete.mutate(deleteReviewId)}
        title="Qiymətləndirməni sil?"
        description="Bu əməliyyat geri qaytarıla bilməz."
        destructive
        loading={reviewDelete.isPending}
      />
    </div>
  );
}
