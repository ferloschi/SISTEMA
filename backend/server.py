from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

from auth import build_auth_router, decode_token  # noqa: E402

app = FastAPI(title="Dra. Brinquinho API")
api_router = APIRouter(prefix="/api")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# =====================
# Models
# =====================
class ProductVariant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    material: Optional[str] = ""
    color: Optional[str] = ""
    size: Optional[str] = ""
    fornecedor: Optional[str] = ""
    purchase_value: float = 0.0
    sale_value: float = 0.0
    stock_qty: int = 0
    min_stock: int = 0
    photo: Optional[str] = ""  # variant-level base64 photo (optional)


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    category: str = "Outros"
    insumo: Optional[str] = ""
    modelo: Optional[str] = ""
    notes: Optional[str] = ""
    photo: Optional[str] = ""  # parent-level base64 (fallback)
    variants: List[ProductVariant] = Field(default_factory=list)
    # Legacy fields kept for backward compatibility with existing UIs.
    # When a product has variants, prefer reading from `variants[0]` or the
    # specific variant in question.
    material: Optional[str] = ""
    color: Optional[str] = ""
    size: Optional[str] = ""
    fornecedor: Optional[str] = ""
    purchase_value: float = 0.0
    sale_value: float = 0.0
    indirect_cost_pct: float = 20.0
    stock_qty: int = 0
    min_stock: int = 0
    created_at: str = Field(default_factory=now_utc_iso)


class ProductVariantInput(BaseModel):
    id: Optional[str] = None
    material: Optional[str] = ""
    color: Optional[str] = ""
    size: Optional[str] = ""
    fornecedor: Optional[str] = ""
    purchase_value: float = 0.0
    sale_value: float = 0.0
    stock_qty: int = 0
    min_stock: int = 0
    photo: Optional[str] = ""


class ProductCreate(BaseModel):
    sku: Optional[str] = None
    name: str
    category: Optional[str] = "Outros"
    insumo: Optional[str] = ""
    modelo: Optional[str] = ""
    notes: Optional[str] = ""
    photo: Optional[str] = ""
    variants: List[ProductVariantInput] = Field(default_factory=list)
    # Legacy single-variant fields still accepted; converted to variants[0]
    # if `variants` is empty.
    material: Optional[str] = ""
    color: Optional[str] = ""
    size: Optional[str] = ""
    fornecedor: Optional[str] = ""
    purchase_value: float = 0.0
    sale_value: float = 0.0
    indirect_cost_pct: float = 20.0
    stock_qty: int = 0
    min_stock: int = 0


class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    child_name: Optional[str] = ""
    parent_name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    birth_date: Optional[str] = ""
    comorbidades: Optional[str] = ""
    anamnese: Optional[Dict[str, Any]] = {}
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_utc_iso)


class PatientCreate(BaseModel):
    child_name: Optional[str] = ""
    parent_name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    birth_date: Optional[str] = ""
    comorbidades: Optional[str] = ""
    anamnese: Optional[Dict[str, Any]] = {}
    notes: Optional[str] = ""


class Insumo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    purchase_value: float = 0.0
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_utc_iso)


class InsumoCreate(BaseModel):
    name: str
    purchase_value: float = 0.0
    notes: Optional[str] = ""


class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: Optional[str] = ""
    patient_name: str  # who comes (parent or adult)
    child_name: Optional[str] = ""
    procedure_type: str  # perfuração baby / piercing / lobuloplastia / laser / laserterapia
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    status: str = "agendado"  # agendado, realizado, cancelado
    notes: Optional[str] = ""
    post_sale_date: Optional[str] = ""  # auto +45 days from date
    reminder_status: str = "pendente"  # pendente, contatado, enviado
    created_at: str = Field(default_factory=now_utc_iso)


class AppointmentCreate(BaseModel):
    patient_id: Optional[str] = ""
    patient_name: str
    child_name: Optional[str] = ""
    procedure_type: str
    date: str
    time: str
    status: Optional[str] = "agendado"
    notes: Optional[str] = ""


class SaleItem(BaseModel):
    product_id: Optional[str] = ""
    variant_id: Optional[str] = ""
    name: str
    qty: int = 1
    unit_price: float = 0.0
    unit_cost: float = 0.0


class PaymentEntry(BaseModel):
    method_id: str
    method_name: str = ""
    amount: float = 0.0
    card_fee_pct: float = 0.0
    fee_amount: float = 0.0
    net_value: float = 0.0
    installments: int = 1
    receive_schedule: List[dict] = []


class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_date: str  # YYYY-MM-DD
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    child_name: Optional[str] = ""
    items: List[SaleItem] = []
    description: Optional[str] = ""
    gross_value: float = 0.0
    payment_method_id: Optional[str] = ""
    payment_method_name: str = ""
    card_fee_pct: float = 0.0
    fee_amount: float = 0.0
    net_value: float = 0.0
    total_cost: float = 0.0
    profit: float = 0.0
    installments: int = 1
    receive_schedule: List[dict] = []
    payments: List[PaymentEntry] = []  # mixed payments (if more than one method)
    receive_date: Optional[str] = ""
    post_sale_date: Optional[str] = ""
    appointment_id: Optional[str] = ""
    created_at: str = Field(default_factory=now_utc_iso)


class SaleCreate(BaseModel):
    sale_date: str
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    child_name: Optional[str] = ""
    items: List[SaleItem] = []
    description: Optional[str] = ""
    payment_method_id: Optional[str] = ""
    card_fee_pct: Optional[float] = None
    installments: Optional[int] = 1
    payments: Optional[List[Dict[str, Any]]] = None
    appointment_id: Optional[str] = ""


class ProcedureItem(BaseModel):
    product_id: Optional[str] = ""
    name: str
    qty: float = 1.0
    unit_cost: float = 0.0


class Procedure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    items: List[ProcedureItem] = []
    indirect_cost_pct: float = 20.0
    margin_pct: float = 100.0
    manual_price: float = 0.0  # 0 = use suggested
    active: bool = True
    created_at: str = Field(default_factory=now_utc_iso)


class ProcedureCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    items: List[ProcedureItem] = []
    indirect_cost_pct: float = 20.0
    margin_pct: float = 100.0
    manual_price: float = 0.0
    active: bool = True


class PaymentMethod(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    card_fee_pct: float = 0.0
    is_card: bool = False
    active: bool = True
    created_at: str = Field(default_factory=now_utc_iso)


class PaymentMethodCreate(BaseModel):
    name: str
    card_fee_pct: float = 0.0
    is_card: bool = False
    active: bool = True


# =====================
# Helpers
# =====================
async def next_sku() -> str:
    count = await db.products.count_documents({})
    return f"SKU{1000 + count + 1}"


async def ensure_default_payment_methods():
    count = await db.payment_methods.count_documents({})
    if count == 0:
        defaults = [
            {"name": "Dinheiro", "card_fee_pct": 0.0, "is_card": False},
            {"name": "PIX", "card_fee_pct": 0.0, "is_card": False},
            {"name": "Cartão Débito", "card_fee_pct": 1.99, "is_card": True},
            {"name": "Cartão Crédito", "card_fee_pct": 3.99, "is_card": True},
        ]
        for d in defaults:
            pm = PaymentMethod(**d)
            await db.payment_methods.insert_one(pm.model_dump())


# =====================
# Products / Estoque
# =====================
MAX_PHOTO_BYTES = 280_000  # ~200KB base64 with overhead


def _validate_photo(photo: Optional[str]):
    if not photo:
        return
    # data URL: "data:image/png;base64,...."
    if len(photo) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Foto excede 200KB. Reduza a imagem e tente novamente.",
        )
    if not photo.startswith("data:image/"):
        raise HTTPException(
            status_code=400, detail="Formato de imagem inválido."
        )


def _ensure_variants(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Make sure product doc has at least one variant.

    Legacy products were stored with flat color/material/stock fields.
    We synthesize a single variant from those legacy fields, leaving the
    legacy fields intact for any consumer that still reads them.
    """
    if doc.get("variants"):
        return doc
    legacy_variant = {
        "id": str(uuid.uuid4()),
        "material": doc.get("material") or "",
        "color": doc.get("color") or "",
        "size": doc.get("size") or "",
        "fornecedor": doc.get("fornecedor") or "",
        "purchase_value": float(doc.get("purchase_value") or 0),
        "sale_value": float(doc.get("sale_value") or 0),
        "stock_qty": int(doc.get("stock_qty") or 0),
        "min_stock": int(doc.get("min_stock") or 0),
        "photo": "",
    }
    doc["variants"] = [legacy_variant]
    return doc


def _sync_legacy_fields(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Mirror the FIRST variant onto the parent's legacy fields and aggregate
    totals (stock_qty = sum of variants) for backward-compat consumers."""
    variants = doc.get("variants") or []
    if not variants:
        return doc
    first = variants[0]
    doc["material"] = first.get("material") or ""
    doc["color"] = first.get("color") or ""
    doc["size"] = first.get("size") or ""
    doc["fornecedor"] = first.get("fornecedor") or ""
    doc["purchase_value"] = float(first.get("purchase_value") or 0)
    doc["sale_value"] = float(first.get("sale_value") or 0)
    doc["min_stock"] = int(first.get("min_stock") or 0)
    doc["stock_qty"] = sum(int(v.get("stock_qty") or 0) for v in variants)
    return doc


def _process_variants(variants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Validate photos, ensure ids, and coerce numbers on each variant."""
    out = []
    for v in variants or []:
        _validate_photo(v.get("photo"))
        out.append({
            "id": v.get("id") or str(uuid.uuid4()),
            "material": v.get("material") or "",
            "color": v.get("color") or "",
            "size": v.get("size") or "",
            "fornecedor": v.get("fornecedor") or "",
            "purchase_value": float(v.get("purchase_value") or 0),
            "sale_value": float(v.get("sale_value") or 0),
            "stock_qty": int(v.get("stock_qty") or 0),
            "min_stock": int(v.get("min_stock") or 0),
            "photo": v.get("photo") or "",
        })
    return out


async def _decrement_variant_stock(product_id: str, variant_id: Optional[str], qty: int):
    """Decrement stock on the variant identified by `variant_id`, or on the
    first variant if not provided. Legacy aggregated `stock_qty` is recomputed.
    """
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        return
    doc = _ensure_variants(doc)
    target_id = variant_id or (doc["variants"][0]["id"] if doc["variants"] else None)
    for v in doc["variants"]:
        if v["id"] == target_id:
            v["stock_qty"] = max(0, int(v.get("stock_qty") or 0) - int(qty))
            break
    _sync_legacy_fields(doc)
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"variants": doc["variants"], "stock_qty": doc["stock_qty"]}},
    )


async def _increment_variant_stock(product_id: str, variant_id: Optional[str], qty: int):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        return
    doc = _ensure_variants(doc)
    target_id = variant_id or (doc["variants"][0]["id"] if doc["variants"] else None)
    for v in doc["variants"]:
        if v["id"] == target_id:
            v["stock_qty"] = int(v.get("stock_qty") or 0) + int(qty)
            break
    _sync_legacy_fields(doc)
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"variants": doc["variants"], "stock_qty": doc["stock_qty"]}},
    )


@api_router.get("/products", response_model=List[Product])
async def list_products(q: Optional[str] = None):
    query: Dict[str, Any] = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]}
    raw = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    items = [_sync_legacy_fields(_ensure_variants(p)) for p in raw]
    return items


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductCreate):
    data = payload.model_dump()
    _validate_photo(data.get("photo"))
    if not data.get("sku"):
        data["sku"] = await next_sku()
    # Convert legacy single-variant input to variants[] if needed
    variants_in = data.get("variants") or []
    if not variants_in:
        variants_in = [{
            "material": data.get("material") or "",
            "color": data.get("color") or "",
            "size": data.get("size") or "",
            "fornecedor": data.get("fornecedor") or "",
            "purchase_value": data.get("purchase_value") or 0,
            "sale_value": data.get("sale_value") or 0,
            "stock_qty": data.get("stock_qty") or 0,
            "min_stock": data.get("min_stock") or 0,
            "photo": "",
        }]
    data["variants"] = _process_variants(variants_in)
    _sync_legacy_fields(data)
    prod = Product(**data)
    await db.products.insert_one(prod.model_dump())
    return prod


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductCreate):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Produto não encontrado")
    data = payload.model_dump()
    _validate_photo(data.get("photo"))
    if not data.get("sku"):
        data["sku"] = existing["sku"]
    variants_in = data.get("variants") or []
    if not variants_in:
        # Fallback: build from legacy fields
        variants_in = [{
            "material": data.get("material") or "",
            "color": data.get("color") or "",
            "size": data.get("size") or "",
            "fornecedor": data.get("fornecedor") or "",
            "purchase_value": data.get("purchase_value") or 0,
            "sale_value": data.get("sale_value") or 0,
            "stock_qty": data.get("stock_qty") or 0,
            "min_stock": data.get("min_stock") or 0,
            "photo": "",
        }]
    data["variants"] = _process_variants(variants_in)
    _sync_legacy_fields(data)
    existing.update(data)
    await db.products.update_one({"id": product_id}, {"$set": data})
    return Product(**existing)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Produto não encontrado")
    return {"ok": True}


# =====================
# Patients
# =====================
@api_router.get("/patients", response_model=List[Patient])
async def list_patients(q: Optional[str] = None):
    query = {}
    if q:
        query = {"$or": [
            {"parent_name": {"$regex": q, "$options": "i"}},
            {"child_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}
    items = await db.patients.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items


@api_router.post("/patients", response_model=Patient)
async def create_patient(payload: PatientCreate):
    pt = Patient(**payload.model_dump())
    await db.patients.insert_one(pt.model_dump())
    return pt


@api_router.put("/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, payload: PatientCreate):
    existing = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Paciente não encontrado")
    data = payload.model_dump()
    existing.update(data)
    await db.patients.update_one({"id": patient_id}, {"$set": data})
    return Patient(**existing)


@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    existing = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Paciente não encontrado")

    # Cascade: find all sales of this patient and restore product stock first
    sales_cursor = db.sales.find({"patient_id": patient_id}, {"_id": 0})
    async for sale in sales_cursor:
        for it in sale.get("items", []):
            if it.get("product_id"):
                await _increment_variant_stock(
                    it["product_id"],
                    it.get("variant_id"),
                    int(it.get("qty", 0)),
                )

    sales_res = await db.sales.delete_many({"patient_id": patient_id})
    appts_res = await db.appointments.delete_many({"patient_id": patient_id})
    await db.patients.delete_one({"id": patient_id})

    return {
        "ok": True,
        "deleted_sales": sales_res.deleted_count,
        "deleted_appointments": appts_res.deleted_count,
    }


# =====================
# Appointments
# =====================
def compute_post_sale_date(d: str) -> str:
    try:
        dt = datetime.strptime(d, "%Y-%m-%d").date()
        return (dt + timedelta(days=45)).isoformat()
    except Exception:
        return ""


@api_router.get("/appointments", response_model=List[Appointment])
async def list_appointments(date_from: Optional[str] = None, date_to: Optional[str] = None):
    query = {}
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    items = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(5000)
    return items


@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate):
    data = payload.model_dump()
    appt = Appointment(**data)
    appt.post_sale_date = compute_post_sale_date(appt.date)
    await db.appointments.insert_one(appt.model_dump())
    return appt


@api_router.put("/appointments/{appt_id}", response_model=Appointment)
async def update_appointment(appt_id: str, payload: AppointmentCreate):
    existing = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Agendamento não encontrado")
    data = payload.model_dump()
    data["post_sale_date"] = compute_post_sale_date(data["date"])
    existing.update(data)
    await db.appointments.update_one({"id": appt_id}, {"$set": data})
    return Appointment(**existing)


@api_router.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str):
    res = await db.appointments.delete_one({"id": appt_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Agendamento não encontrado")
    return {"ok": True}


@api_router.post("/appointments/{appt_id}/mark-reminder-sent")
async def mark_reminder_sent(appt_id: str):
    res = await db.appointments.update_one({"id": appt_id}, {"$set": {"reminder_status": "enviado"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Agendamento não encontrado")
    return {"ok": True}


# =====================
# Payment Methods
# =====================
@api_router.get("/payment-methods", response_model=List[PaymentMethod])
async def list_payment_methods():
    await ensure_default_payment_methods()
    items = await db.payment_methods.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return items


@api_router.post("/payment-methods", response_model=PaymentMethod)
async def create_payment_method(payload: PaymentMethodCreate):
    pm = PaymentMethod(**payload.model_dump())
    await db.payment_methods.insert_one(pm.model_dump())
    return pm


@api_router.put("/payment-methods/{pm_id}", response_model=PaymentMethod)
async def update_payment_method(pm_id: str, payload: PaymentMethodCreate):
    existing = await db.payment_methods.find_one({"id": pm_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Forma de pagamento não encontrada")
    data = payload.model_dump()
    existing.update(data)
    await db.payment_methods.update_one({"id": pm_id}, {"$set": data})
    return PaymentMethod(**existing)


@api_router.delete("/payment-methods/{pm_id}")
async def delete_payment_method(pm_id: str):
    res = await db.payment_methods.delete_one({"id": pm_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Forma de pagamento não encontrada")
    return {"ok": True}


# =====================
# Insumos (Precificação)
# =====================
@api_router.get("/insumos", response_model=List[Insumo])
async def list_insumos():
    items = await db.insumos.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
    return items


@api_router.post("/insumos", response_model=Insumo)
async def create_insumo(payload: InsumoCreate):
    ins = Insumo(**payload.model_dump())
    await db.insumos.insert_one(ins.model_dump())
    return ins


@api_router.put("/insumos/{insumo_id}", response_model=Insumo)
async def update_insumo(insumo_id: str, payload: InsumoCreate):
    existing = await db.insumos.find_one({"id": insumo_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Insumo não encontrado")
    data = payload.model_dump()
    existing.update(data)
    await db.insumos.update_one({"id": insumo_id}, {"$set": data})
    return Insumo(**existing)


@api_router.delete("/insumos/{insumo_id}")
async def delete_insumo(insumo_id: str):
    res = await db.insumos.delete_one({"id": insumo_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Insumo não encontrado")
    return {"ok": True}


# =====================
# Procedures (Precificação)
# =====================
def enrich_procedure(p: dict) -> dict:
    items = p.get("items", [])
    items_cost = sum(float(i.get("qty", 0)) * float(i.get("unit_cost", 0)) for i in items)
    indirect_pct = float(p.get("indirect_cost_pct", 0))
    margin_pct = float(p.get("margin_pct", 0))
    indirect_value = round(items_cost * indirect_pct / 100, 2)
    total_cost = round(items_cost + indirect_value, 2)
    margin_value = round(total_cost * margin_pct / 100, 2)
    suggested_price = round(total_cost + margin_value, 2)
    manual = float(p.get("manual_price", 0) or 0)
    final_price = manual if manual > 0 else suggested_price
    p["items_cost"] = round(items_cost, 2)
    p["indirect_value"] = indirect_value
    p["total_cost"] = total_cost
    p["margin_value"] = margin_value
    p["suggested_price"] = suggested_price
    p["final_price"] = round(final_price, 2)
    return p


@api_router.get("/procedures")
async def list_procedures():
    items = await db.procedures.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [enrich_procedure(p) for p in items]


@api_router.post("/procedures")
async def create_procedure(payload: ProcedureCreate):
    proc = Procedure(**payload.model_dump())
    doc = proc.model_dump()
    await db.procedures.insert_one(doc)
    doc.pop("_id", None)
    return enrich_procedure(doc)


@api_router.put("/procedures/{proc_id}")
async def update_procedure(proc_id: str, payload: ProcedureCreate):
    existing = await db.procedures.find_one({"id": proc_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Procedimento não encontrado")
    data = payload.model_dump()
    existing.update(data)
    await db.procedures.update_one({"id": proc_id}, {"$set": data})
    return enrich_procedure(existing)


@api_router.delete("/procedures/{proc_id}")
async def delete_procedure(proc_id: str):
    res = await db.procedures.delete_one({"id": proc_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Procedimento não encontrado")
    return {"ok": True}


# =====================
# Sales
# =====================
async def compute_sale(payload: SaleCreate) -> Sale:
    items = [i if isinstance(i, SaleItem) else SaleItem(**i) for i in payload.items]
    cost = sum(i.qty * i.unit_cost for i in items)
    items_gross = sum(i.qty * i.unit_price for i in items)
    post_sale = compute_post_sale_date(payload.sale_date)
    sale_date_obj = datetime.strptime(payload.sale_date, "%Y-%m-%d").date()

    # ---- MIXED PAYMENT MODE ----
    if payload.payments and len(payload.payments) > 0:
        payment_entries: List[PaymentEntry] = []
        merged_schedule: List[dict] = []
        total_fee = 0.0
        method_names_parts: List[str] = []
        for p in payload.payments:
            pm = await db.payment_methods.find_one(
                {"id": p.get("method_id")}, {"_id": 0}
            )
            if not pm:
                raise HTTPException(400, "Forma de pagamento inválida")
            amount = float(p.get("amount", 0) or 0)
            if "card_fee_pct" in p and p.get("card_fee_pct") is not None:
                fee_pct = float(p["card_fee_pct"])
            else:
                fee_pct = pm.get("card_fee_pct", 0.0) if pm.get("is_card") else 0.0
            fee_amt = round(amount * fee_pct / 100, 2)
            net = round(amount - fee_amt, 2)
            installments = max(1, int(p.get("installments", 1) or 1))
            sched: List[dict] = []
            if pm.get("is_card"):
                per = round(net / installments, 2) if installments > 0 else net
                acc = 0.0
                for i in range(installments):
                    recv = sale_date_obj + timedelta(days=30 * (i + 1))
                    if i < installments - 1:
                        val = per
                        acc += val
                    else:
                        val = round(net - acc, 2)
                    sched.append(
                        {"installment": i + 1, "date": recv.isoformat(), "value": val}
                    )
                merged_schedule.extend(
                    [{**s, "method": pm["name"]} for s in sched]
                )
            payment_entries.append(
                PaymentEntry(
                    method_id=pm["id"],
                    method_name=pm["name"],
                    amount=round(amount, 2),
                    card_fee_pct=fee_pct,
                    fee_amount=fee_amt,
                    net_value=net,
                    installments=installments,
                    receive_schedule=sched,
                )
            )
            total_fee += fee_amt
            method_names_parts.append(f"{pm['name']} ({amount:.2f})")

        gross = sum(p.amount for p in payment_entries)
        net_value = round(gross - total_fee, 2)
        profit = round(gross - cost - total_fee, 2)
        method_name = " + ".join(method_names_parts)
        return Sale(
            sale_date=payload.sale_date,
            patient_id=payload.patient_id or "",
            patient_name=payload.patient_name or "",
            child_name=payload.child_name or "",
            items=items,
            description=payload.description or "",
            gross_value=round(gross, 2),
            payment_method_id="",
            payment_method_name=method_name,
            card_fee_pct=0.0,
            fee_amount=round(total_fee, 2),
            net_value=net_value,
            total_cost=round(cost, 2),
            profit=profit,
            installments=1,
            receive_schedule=merged_schedule,
            payments=payment_entries,
            receive_date=merged_schedule[0]["date"]
            if merged_schedule
            else payload.sale_date,
            post_sale_date=post_sale,
            appointment_id=payload.appointment_id or "",
        )

    # ---- SINGLE PAYMENT MODE ----
    if not payload.payment_method_id:
        raise HTTPException(400, "Forma de pagamento obrigatória")
    pm = await db.payment_methods.find_one(
        {"id": payload.payment_method_id}, {"_id": 0}
    )
    if not pm:
        raise HTTPException(400, "Forma de pagamento inválida")
    gross = items_gross
    if payload.card_fee_pct is not None:
        fee_pct = float(payload.card_fee_pct)
    else:
        fee_pct = pm.get("card_fee_pct", 0.0) if pm.get("is_card") else 0.0
    fee_amount = round(gross * fee_pct / 100, 2)
    net_value = round(gross - fee_amount, 2)
    profit = round(gross - cost - fee_amount, 2)
    installments = max(1, int(payload.installments or 1))
    schedule = []
    if pm.get("is_card"):
        per = round(net_value / installments, 2)
        accumulated = 0.0
        for i in range(installments):
            recv_date = sale_date_obj + timedelta(days=30 * (i + 1))
            if i < installments - 1:
                val = per
                accumulated += val
            else:
                val = round(net_value - accumulated, 2)
            schedule.append(
                {"installment": i + 1, "date": recv_date.isoformat(), "value": val}
            )
        receive_date = schedule[0]["date"] if schedule else payload.sale_date
    else:
        receive_date = payload.sale_date

    return Sale(
        sale_date=payload.sale_date,
        patient_id=payload.patient_id or "",
        patient_name=payload.patient_name or "",
        child_name=payload.child_name or "",
        items=items,
        description=payload.description or "",
        gross_value=round(gross, 2),
        payment_method_id=pm["id"],
        payment_method_name=pm["name"],
        card_fee_pct=fee_pct,
        fee_amount=fee_amount,
        net_value=net_value,
        total_cost=round(cost, 2),
        profit=profit,
        installments=installments,
        receive_schedule=schedule,
        payments=[],
        receive_date=receive_date,
        post_sale_date=post_sale,
        appointment_id=payload.appointment_id or "",
    )


@api_router.get("/sales", response_model=List[Sale])
async def list_sales(month: Optional[str] = None, patient_id: Optional[str] = None):
    """month format: YYYY-MM"""
    query = {}
    if month:
        query["sale_date"] = {"$regex": f"^{month}"}
    if patient_id:
        query["patient_id"] = patient_id
    items = await db.sales.find(query, {"_id": 0}).sort("sale_date", -1).to_list(5000)
    return items


@api_router.post("/sales", response_model=Sale)
async def create_sale(payload: SaleCreate):
    sale = await compute_sale(payload)
    await db.sales.insert_one(sale.model_dump())
    # decrement stock on the specific variant when product_id is set
    for it in sale.items:
        if it.product_id:
            await _decrement_variant_stock(
                it.product_id, getattr(it, "variant_id", None), int(it.qty)
            )
    return sale


class ReceivedPayload(BaseModel):
    received: bool


@api_router.post("/sales/bulk-delete")
async def bulk_delete_sales(
    month: Optional[str] = None,
    year: Optional[int] = None,
    bucket: Optional[str] = None,
):
    """Bulk delete sales filtered by month (YYYY-MM), year, and/or bucket.
    Restores stock for each product/variant on the deleted sales.

    bucket values match /finance/summary: dinheiro, pix, debito, cartao_parcelado, outros

    IMPORTANTE: esta rota deve ficar ANTES de DELETE /sales/{sale_id} para evitar
    que o FastAPI interprete 'bulk-delete' como um sale_id.
    """
    query: Dict[str, Any] = {}
    if month:
        query["sale_date"] = {"$regex": f"^{month}"}
    elif year:
        query["sale_date"] = {"$regex": f"^{year}-"}

    bucket_map = {
        "dinheiro": ["Dinheiro"],
        "pix": ["PIX", "Pix"],
        "debito": ["Cartão Débito", "Débito"],
        "cartao_parcelado": ["Cartão Crédito", "Crédito"],
    }
    if bucket == "cartao_parcelado":
        query["payment_method_name"] = {"$in": bucket_map["cartao_parcelado"]}
    elif bucket in bucket_map:
        query["payment_method_name"] = {"$in": bucket_map[bucket]}
    elif bucket == "outros":
        known = sum(bucket_map.values(), [])
        query["payment_method_name"] = {"$nin": known}

    cursor = db.sales.find(query, {"_id": 0})
    ids = []
    async for sale in cursor:
        ids.append(sale["id"])
        for it in sale.get("items", []):
            if it.get("product_id"):
                await _increment_variant_stock(
                    it["product_id"], it.get("variant_id"), int(it.get("qty", 0))
                )
    if ids:
        await db.sales.delete_many({"id": {"$in": ids}})
    return {"ok": True, "deleted": len(ids)}


@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str):
    existing = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Venda não encontrada")
    for it in existing.get("items", []):
        if it.get("product_id"):
            await _increment_variant_stock(
                it["product_id"], it.get("variant_id"), int(it.get("qty", 0))
            )
    await db.sales.delete_one({"id": sale_id})
    return {"ok": True}


@api_router.delete("/sales/{sale_id}/installments/{installment_num}")
async def delete_installment(sale_id: str, installment_num: int):
    """Remove a single installment from a sale's receive schedule.
    The sale itself is kept (other installments remain)."""
    existing = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Venda não encontrada")
    schedule = existing.get("receive_schedule") or []
    new_schedule = [r for r in schedule if int(r.get("installment", 0)) != installment_num]
    if len(new_schedule) == len(schedule):
        raise HTTPException(404, "Parcela não encontrada")
    await db.sales.update_one(
        {"id": sale_id}, {"$set": {"receive_schedule": new_schedule}}
    )
    return {"ok": True, "remaining": len(new_schedule)}


@api_router.patch("/sales/{sale_id}/installments/{installment_num}")
async def toggle_installment_received(sale_id: str, installment_num: int, payload: ReceivedPayload):
    """Mark an installment as received/pending."""
    existing = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Venda não encontrada")
    schedule = existing.get("receive_schedule") or []
    updated = False
    for r in schedule:
        if int(r.get("installment", 0)) == installment_num:
            r["received"] = bool(payload.received)
            r["received_date"] = date.today().isoformat() if payload.received else ""
            updated = True
            break
    if not updated:
        raise HTTPException(404, "Parcela não encontrada")
    await db.sales.update_one(
        {"id": sale_id}, {"$set": {"receive_schedule": schedule}}
    )
    return {"ok": True, "schedule": schedule}


# =====================
# Dashboard
# =====================
@api_router.get("/dashboard")
async def dashboard():
    today = date.today().isoformat()
    month_prefix = today[:7]

    # Today appointments
    today_appts = await db.appointments.count_documents({"date": today})

    # Month sales
    sales_cursor = db.sales.find({"sale_date": {"$regex": f"^{month_prefix}"}}, {"_id": 0})
    month_sales = await sales_cursor.to_list(5000)
    total_gross = sum(s.get("gross_value", 0) for s in month_sales)
    total_profit = sum(s.get("profit", 0) for s in month_sales)
    total_fees = sum(s.get("fee_amount", 0) for s in month_sales)
    total_cost = sum(s.get("total_cost", 0) for s in month_sales)
    sales_count = len(month_sales)

    # Pending post-sale reminders (post_sale_date in past 7d to next 14d, reminder_status pendente)
    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    in_14 = (date.today() + timedelta(days=14)).isoformat()
    pending_reminders = await db.appointments.count_documents({
        "post_sale_date": {"$gte": seven_ago, "$lte": in_14},
        "reminder_status": "pendente",
        "status": {"$ne": "cancelado"},
    })

    # Low stock count
    low_stock = await db.products.count_documents({
        "$expr": {"$lte": ["$stock_qty", "$min_stock"]}
    })

    # Daily sales for chart (current month)
    by_day = {}
    for s in month_sales:
        d = s.get("sale_date", "")
        by_day[d] = by_day.get(d, 0) + s.get("gross_value", 0)
    chart = [{"date": k, "value": round(v, 2)} for k, v in sorted(by_day.items())]

    # Sales by payment method
    by_pm = {}
    for s in month_sales:
        pm = s.get("payment_method_name", "—")
        by_pm[pm] = by_pm.get(pm, 0) + s.get("gross_value", 0)
    pm_chart = [{"name": k, "value": round(v, 2)} for k, v in by_pm.items()]

    return {
        "today": today,
        "month": month_prefix,
        "today_appointments": today_appts,
        "month_gross": round(total_gross, 2),
        "month_profit": round(total_profit, 2),
        "month_fees": round(total_fees, 2),
        "month_cost": round(total_cost, 2),
        "sales_count": sales_count,
        "pending_reminders": pending_reminders,
        "low_stock_count": low_stock,
        "chart_daily": chart,
        "chart_payment_methods": pm_chart,
    }


@api_router.get("/reminders/pending")
async def pending_reminders():
    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    in_14 = (date.today() + timedelta(days=14)).isoformat()
    items = await db.appointments.find({
        "post_sale_date": {"$gte": seven_ago, "$lte": in_14},
        "reminder_status": "pendente",
        "status": {"$ne": "cancelado"},
    }, {"_id": 0}).sort("post_sale_date", 1).to_list(500)
    # Enrich with patient phone (and email) from the patients collection.
    patient_ids = list({i.get("patient_id") for i in items if i.get("patient_id")})
    phone_map: Dict[str, Dict[str, str]] = {}
    if patient_ids:
        async for p in db.patients.find(
            {"id": {"$in": patient_ids}},
            {"_id": 0, "id": 1, "phone": 1, "email": 1},
        ):
            phone_map[p["id"]] = {"phone": p.get("phone", ""), "email": p.get("email", "")}
    for i in items:
        info = phone_map.get(i.get("patient_id") or "", {})
        i["patient_phone"] = info.get("phone", "")
        i["patient_email"] = info.get("email", "")
    return items


@api_router.post("/appointments/{appt_id}/mark-called")
async def mark_called(appt_id: str):
    """Mark a post-sale reminder as already contacted (called)."""
    res = await db.appointments.update_one(
        {"id": appt_id}, {"$set": {"reminder_status": "contatado"}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return {"ok": True}


@api_router.post("/appointments/{appt_id}/mark-pending")
async def mark_pending(appt_id: str):
    """Reset a post-sale reminder back to pending (undo)."""
    res = await db.appointments.update_one(
        {"id": appt_id}, {"$set": {"reminder_status": "pendente"}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return {"ok": True}


@api_router.get("/post-sale")
async def list_post_sale(status: Optional[str] = Query(None)):
    """List all appointments with their post-sale info.

    `status` filter values: pendente, contatado, atrasado, all.
    Atrasado = pendente AND post_sale_date < today.
    """
    today_iso = date.today().isoformat()
    query: Dict[str, Any] = {
        "post_sale_date": {"$ne": ""},
        "status": {"$ne": "cancelado"},
    }
    if status == "pendente":
        query["reminder_status"] = "pendente"
    elif status == "contatado":
        query["reminder_status"] = "contatado"
    elif status == "atrasado":
        query["reminder_status"] = "pendente"
        query["post_sale_date"] = {"$lt": today_iso, "$ne": ""}
    # "all" or None: no extra filter

    items = await db.appointments.find(query, {"_id": 0}).sort(
        "post_sale_date", -1
    ).to_list(2000)

    # Enrich with patient phone/email
    pids = list({i.get("patient_id") for i in items if i.get("patient_id")})
    info_map: Dict[str, Dict[str, str]] = {}
    if pids:
        async for p in db.patients.find(
            {"id": {"$in": pids}},
            {"_id": 0, "id": 1, "phone": 1, "email": 1},
        ):
            info_map[p["id"]] = {
                "phone": p.get("phone", ""),
                "email": p.get("email", ""),
            }
    for i in items:
        info = info_map.get(i.get("patient_id") or "", {})
        i["patient_phone"] = info.get("phone", "")
        i["patient_email"] = info.get("email", "")
    return items


@api_router.get("/reports/monthly")
async def reports_monthly(year: int = Query(..., description="Year, e.g. 2026")):
    """Aggregated monthly report for given year."""
    pipeline = [
        {"$match": {"sale_date": {"$regex": f"^{year}-"}}},
        {"$group": {
            "_id": {"$substr": ["$sale_date", 0, 7]},
            "gross": {"$sum": "$gross_value"},
            "cost": {"$sum": "$total_cost"},
            "fees": {"$sum": "$fee_amount"},
            "profit": {"$sum": "$profit"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.sales.aggregate(pipeline).to_list(50)
    return [{
        "month": r["_id"],
        "gross": round(r.get("gross", 0), 2),
        "cost": round(r.get("cost", 0), 2),
        "fees": round(r.get("fees", 0), 2),
        "profit": round(r.get("profit", 0), 2),
        "count": r.get("count", 0),
    } for r in rows]


# =====================
# Finance (Gestão Financeira)
# =====================
def bucket_for_sale(s: dict) -> str:
    """Classify a sale into: dinheiro, pix, debito, cartao_parcelado, misto, outros."""
    payments = s.get("payments") or []
    if len(payments) > 1:
        return "misto"
    name = (s.get("payment_method_name") or "").lower()
    installments = int(s.get("installments", 1) or 1)
    if "dinheiro" in name and "+" not in name:
        return "dinheiro"
    if "pix" in name and "+" not in name:
        return "pix"
    if ("débito" in name or "debito" in name) and "+" not in name:
        return "debito"
    if (
        installments > 1
        or "crédito" in name
        or "credito" in name
        or "cartão" in name
        or "cartao" in name
    ):
        return "cartao_parcelado"
    return "outros"


def bucket_for_payment(method_name: str, installments: int = 1) -> str:
    n = (method_name or "").lower()
    if "dinheiro" in n:
        return "dinheiro"
    if "pix" in n:
        return "pix"
    if "débito" in n or "debito" in n:
        return "debito"
    if installments > 1 or "crédito" in n or "credito" in n or "cartão" in n or "cartao" in n:
        return "cartao_parcelado"
    return "outros"


@api_router.get("/finance/summary")
async def finance_summary(month: Optional[str] = None, year: Optional[int] = None):
    """Aggregated payment values. Provide month=YYYY-MM or year=YYYY.
    For mixed payments, each method's amount is allocated to its proper bucket."""
    query = {}
    if month:
        query["sale_date"] = {"$regex": f"^{month}"}
    elif year:
        query["sale_date"] = {"$regex": f"^{year}-"}
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    buckets = {"dinheiro": 0.0, "pix": 0.0, "debito": 0.0, "cartao_parcelado": 0.0, "outros": 0.0}
    counts = {k: 0 for k in buckets}
    for s in sales:
        payments = s.get("payments") or []
        if len(payments) > 1:
            # Allocate each payment to its proper bucket
            for p in payments:
                b = bucket_for_payment(p.get("method_name", ""), int(p.get("installments", 1) or 1))
                buckets[b] += float(p.get("amount", 0))
                counts[b] += 1
        else:
            b = bucket_for_sale(s)
            if b == "misto":
                b = "outros"
            buckets[b] += s.get("gross_value", 0)
            counts[b] += 1
    total = sum(buckets.values())
    return {
        "scope": {"month": month, "year": year},
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "counts": counts,
        "total": round(total, 2),
        "sales_count": len(sales),
    }


@api_router.get("/finance/card-sales")
async def finance_card_sales(month: Optional[str] = None):
    """List card-payment sales with installment schedules."""
    query = {}
    if month:
        query["sale_date"] = {"$regex": f"^{month}"}
    sales = await db.sales.find(query, {"_id": 0}).sort("sale_date", -1).to_list(5000)
    # only card sales
    card_sales_list = [s for s in sales if bucket_for_sale(s) in ("debito", "cartao_parcelado")]
    return card_sales_list


@api_router.get("/finance/receivables")
async def finance_receivables(month: Optional[str] = None):
    """Receivables expected per month (from schedules) with received vs pending."""
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    by_month: dict[str, dict] = {}
    for s in sales:
        for r in s.get("receive_schedule", []) or []:
            ym = (r.get("date") or "")[:7]
            if not ym:
                continue
            if ym not in by_month:
                by_month[ym] = {"value": 0.0, "received": 0.0, "pending": 0.0}
            val = float(r.get("value", 0))
            by_month[ym]["value"] += val
            if r.get("received"):
                by_month[ym]["received"] += val
            else:
                by_month[ym]["pending"] += val
    rows = [
        {
            "month": k,
            "value": round(v["value"], 2),
            "received": round(v["received"], 2),
            "pending": round(v["pending"], 2),
        }
        for k, v in sorted(by_month.items())
    ]
    if month:
        rows = [r for r in rows if r["month"] == month]
    return rows


@api_router.get("/")
async def root():
    return {"app": "Dra. Brinquinho", "status": "ok"}


app.include_router(api_router)
app.include_router(build_auth_router(db), prefix="/api")


@app.middleware("http")
async def auth_middleware(request, call_next):
    """Require Bearer token on every /api/* except /api/auth/* and the root."""
    path = request.url.path
    method = request.method
    PUBLIC_PATHS = {"/api/", "/api"}
    if (
        method == "OPTIONS"
        or path.startswith("/api/auth/")
        or path in PUBLIC_PATHS
        or not path.startswith("/api/")
    ):
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse({"detail": "Não autenticado."}, status_code=401)
    token = auth_header[7:]
    try:
        decode_token(token)
    except HTTPException as exc:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await ensure_default_payment_methods()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
