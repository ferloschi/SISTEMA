from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
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


MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def validate_month(month: Optional[str]) -> None:
    if month and not MONTH_PATTERN.fullmatch(month):
        raise HTTPException(400, "Mês inválido. Use o formato AAAA-MM.")


def validate_year(year: Optional[int]) -> None:
    if year is not None and not 2000 <= year <= 2100:
        raise HTTPException(400, "Ano inválido.")


def parse_iso_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise HTTPException(400, "Data inválida. Use o formato AAAA-MM-DD.")


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
    patient_name: Optional[str] = ""
    phone: Optional[str] = ""
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
    # Pós-venda: 45 dias após a data da venda, para follow-up
    post_sale_date: Optional[str] = ""
    post_sale_contacted: bool = False
    created_at: str = Field(default_factory=now_utc_iso)


class SaleCreate(BaseModel):
    sale_date: str
    patient_name: Optional[str] = ""
    phone: Optional[str] = ""
    items: List[SaleItem] = []
    description: Optional[str] = ""
    payment_method_id: Optional[str] = ""
    card_fee_pct: Optional[float] = None
    installments: Optional[int] = 1
    payments: Optional[List[Dict[str, Any]]] = None


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


def compute_post_sale_date(d: str) -> str:
    """Data de follow-up: 45 dias após a data informada (YYYY-MM-DD)."""
    try:
        dt = datetime.strptime(d, "%Y-%m-%d").date()
        return (dt + timedelta(days=45)).isoformat()
    except Exception:
        return ""


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


async def _validate_stock_for_sale(items: List[SaleItem]) -> None:
    """Validate product/variant references and aggregate stock requirements.

    This prevents a sale from being recorded when one or more lines would
    consume more stock than is available.
    """
    products: Dict[str, Dict[str, Any]] = {}
    required: Dict[tuple[str, str], int] = {}

    for item in items:
        if not item.product_id:
            continue
        if item.product_id not in products:
            doc = await db.products.find_one({"id": item.product_id}, {"_id": 0})
            if not doc:
                raise HTTPException(400, f'Produto "{item.name}" não encontrado.')
            products[item.product_id] = _ensure_variants(doc)

        doc = products[item.product_id]
        variants = doc.get("variants") or []
        target_id = item.variant_id or (variants[0]["id"] if variants else "")
        variant = next((v for v in variants if v.get("id") == target_id), None)
        if not variant:
            raise HTTPException(400, f'Variante inválida para "{item.name}".')
        key = (item.product_id, target_id)
        required[key] = required.get(key, 0) + int(item.qty)

    for (product_id, variant_id), qty in required.items():
        doc = products[product_id]
        variant = next(v for v in doc["variants"] if v.get("id") == variant_id)
        available = int(variant.get("stock_qty") or 0)
        if qty > available:
            product_name = doc.get("name") or "Produto"
            raise HTTPException(
                400,
                f'Estoque insuficiente para "{product_name}": disponível {available}, solicitado {qty}.',
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
    if not items:
        raise HTTPException(400, "Adicione ao menos um item à venda.")
    for item in items:
        if not (item.name or "").strip():
            raise HTTPException(400, "Todos os itens precisam de um nome.")
        if item.qty <= 0:
            raise HTTPException(400, "A quantidade dos itens deve ser maior que zero.")
        if item.unit_price < 0 or item.unit_cost < 0:
            raise HTTPException(400, "Preço e custo dos itens não podem ser negativos.")
    cost = sum(i.qty * i.unit_cost for i in items)
    items_gross = sum(i.qty * i.unit_price for i in items)
    sale_date_obj = parse_iso_date(payload.sale_date)
    post_sale = (sale_date_obj + timedelta(days=45)).isoformat()

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
            patient_name=payload.patient_name or "",
            phone=payload.phone or "",
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
            post_sale_contacted=False,
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
        patient_name=payload.patient_name or "",
        phone=payload.phone or "",
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
        post_sale_contacted=False,
    )


@api_router.get("/sales", response_model=List[Sale])
async def list_sales(month: Optional[str] = None):
    """month format: YYYY-MM"""
    validate_month(month)
    query = {}
    if month:
        query["sale_date"] = {"$regex": f"^{month}"}
    items = await db.sales.find(query, {"_id": 0}).sort("sale_date", -1).to_list(5000)
    return items


@api_router.post("/sales", response_model=Sale)
async def create_sale(payload: SaleCreate):
    sale = await compute_sale(payload)
    await _validate_stock_for_sale(sale.items)
    await db.sales.insert_one(sale.model_dump())
    # decrement stock on the specific variant when product_id is set
    for it in sale.items:
        if it.product_id:
            await _decrement_variant_stock(
                it.product_id, getattr(it, "variant_id", None), int(it.qty)
            )
    return sale


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
    """
    validate_month(month)
    validate_year(year)
    allowed_buckets = {"dinheiro", "pix", "debito", "cartao_parcelado", "outros"}
    if bucket and bucket not in allowed_buckets:
        raise HTTPException(400, "Categoria financeira inválida.")
    if not any((month, year, bucket)):
        raise HTTPException(400, "Informe mês, ano ou categoria para excluir vendas.")

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
# Settings (single-doc)
# =====================
DEFAULT_WHATSAPP_TEMPLATE = (
    "Oi, {nome}! Aqui é da Clínica Dra. Brinquinho. "
    "Passando para saber como está a cicatrização do seu piercing feito há cerca de 45 dias. "
    "Está tudo bem? Alguma dúvida ou incômodo? Fico à disposição."
)


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    whatsapp_template: str = DEFAULT_WHATSAPP_TEMPLATE


class SettingsUpdate(BaseModel):
    whatsapp_template: str


async def get_settings_doc() -> Dict[str, Any]:
    doc = await db.settings.find_one({"_id": "app_settings"})
    if not doc:
        base = {"_id": "app_settings", "whatsapp_template": DEFAULT_WHATSAPP_TEMPLATE}
        await db.settings.insert_one(base)
        return base
    return doc


@api_router.get("/settings", response_model=Settings)
async def read_settings():
    doc = await get_settings_doc()
    return Settings(whatsapp_template=doc.get("whatsapp_template") or DEFAULT_WHATSAPP_TEMPLATE)


@api_router.put("/settings", response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    template = (payload.whatsapp_template or "").strip()
    if not template:
        raise HTTPException(400, "A mensagem não pode ficar vazia.")
    if len(template) > 1000:
        raise HTTPException(400, "A mensagem é longa demais (máx. 1000 caracteres).")
    await db.settings.update_one(
        {"_id": "app_settings"},
        {"$set": {"whatsapp_template": template}},
        upsert=True,
    )
    return Settings(whatsapp_template=template)


# =====================
# Pós-venda (45 dias após cada venda)
# =====================
def _sale_to_post_sale(s: Dict[str, Any], sale_count: int = 1) -> Dict[str, Any]:
    """Shape a sale doc into the response the Pós-venda UI expects."""
    items = s.get("items") or []
    items_summary = ", ".join(
        f"{int(it.get('qty', 1))}x {it.get('name', '')}" for it in items
    )
    return {
        "id": s.get("id"),
        "patient_name": s.get("patient_name") or "",
        "phone": s.get("phone") or "",
        "sale_date": s.get("sale_date") or "",
        "post_sale_date": s.get("post_sale_date") or "",
        "post_sale_contacted": bool(s.get("post_sale_contacted", False)),
        "items_summary": items_summary,
        "gross_value": s.get("gross_value", 0),
        "sale_count": sale_count,
    }


def _client_key(s: Dict[str, Any]) -> str:
    """Chave de agrupamento por cliente: telefone (só dígitos) ou nome normalizado."""
    phone = "".join(ch for ch in (s.get("phone") or "") if ch.isdigit())
    if phone:
        return f"tel:{phone}"
    name = (s.get("patient_name") or "").strip().lower()
    return f"name:{name}" if name else ""


async def _sale_counts_map() -> Dict[str, int]:
    """Retorna {client_key: qtd total de vendas} varrendo todas as vendas."""
    counts: Dict[str, int] = {}
    async for s in db.sales.find({}, {"_id": 0, "patient_name": 1, "phone": 1}):
        k = _client_key(s)
        if not k:
            continue
        counts[k] = counts.get(k, 0) + 1
    return counts


@api_router.get("/reminders/pending")
async def pending_reminders():
    """Vendas com pós-venda em janela de -7d a +14d, ainda não contatadas."""
    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    in_14 = (date.today() + timedelta(days=14)).isoformat()
    items = await db.sales.find({
        "post_sale_date": {"$gte": seven_ago, "$lte": in_14},
        "post_sale_contacted": {"$ne": True},
    }, {"_id": 0}).sort("post_sale_date", 1).to_list(500)
    counts = await _sale_counts_map()
    return [_sale_to_post_sale(s, counts.get(_client_key(s), 1)) for s in items]


@api_router.get("/post-sale")
async def list_post_sale(status: Optional[str] = Query(None)):
    """Lista todas as vendas com informação de pós-venda.

    `status`: pendente, contatado, atrasado, all.
    Atrasado = pendente AND post_sale_date < hoje.
    """
    today_iso = date.today().isoformat()
    query: Dict[str, Any] = {
        "post_sale_date": {"$nin": ["", None]},
    }
    if status == "pendente":
        query["post_sale_contacted"] = {"$ne": True}
    elif status == "contatado":
        query["post_sale_contacted"] = True
    elif status == "atrasado":
        query["post_sale_contacted"] = {"$ne": True}
        query["post_sale_date"] = {"$lt": today_iso, "$nin": ["", None]}
    # "all" or None: no extra filter

    items = await db.sales.find(query, {"_id": 0}).sort(
        "post_sale_date", -1
    ).to_list(2000)
    counts = await _sale_counts_map()
    return [_sale_to_post_sale(s, counts.get(_client_key(s), 1)) for s in items]


@api_router.post("/sales/{sale_id}/mark-called")
async def mark_sale_called(sale_id: str):
    """Marcar a venda como já contatada (follow-up de 45 dias feito)."""
    res = await db.sales.update_one(
        {"id": sale_id}, {"$set": {"post_sale_contacted": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return {"ok": True}


@api_router.post("/sales/{sale_id}/mark-pending")
async def mark_sale_pending(sale_id: str):
    """Voltar o follow-up pós-venda para pendente (undo)."""
    res = await db.sales.update_one(
        {"id": sale_id}, {"$set": {"post_sale_contacted": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return {"ok": True}


# =====================
# Dashboard
# =====================
@api_router.get("/dashboard")
async def dashboard():
    today = date.today().isoformat()
    month_prefix = today[:7]

    # Month sales
    sales_cursor = db.sales.find({"sale_date": {"$regex": f"^{month_prefix}"}}, {"_id": 0})
    month_sales = await sales_cursor.to_list(5000)
    total_gross = sum(s.get("gross_value", 0) for s in month_sales)
    total_profit = sum(s.get("profit", 0) for s in month_sales)
    total_fees = sum(s.get("fee_amount", 0) for s in month_sales)
    total_cost = sum(s.get("total_cost", 0) for s in month_sales)
    sales_count = len(month_sales)

    # Vendas de hoje
    today_sales = await db.sales.count_documents({"sale_date": today})

    # Pós-venda pendente (janela -7d a +14d)
    seven_ago = (date.today() - timedelta(days=7)).isoformat()
    in_14 = (date.today() + timedelta(days=14)).isoformat()
    pending_reminders = await db.sales.count_documents({
        "post_sale_date": {"$gte": seven_ago, "$lte": in_14},
        "post_sale_contacted": {"$ne": True},
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
        "today_sales": today_sales,
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


@api_router.get("/reports/monthly")
async def reports_monthly(year: int = Query(..., description="Year, e.g. 2026")):
    """Aggregated monthly report for given year."""
    validate_year(year)
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
    validate_month(month)
    validate_year(year)
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
    validate_month(month)
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
    validate_month(month)
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
    # Backfill: garantir post_sale_date e post_sale_contacted em vendas antigas
    async for s in db.sales.find(
        {"$or": [
            {"post_sale_date": {"$exists": False}},
            {"post_sale_date": ""},
            {"post_sale_contacted": {"$exists": False}},
        ]},
        {"_id": 0, "id": 1, "sale_date": 1, "post_sale_date": 1, "post_sale_contacted": 1},
    ):
        update: Dict[str, Any] = {}
        if not s.get("post_sale_date"):
            update["post_sale_date"] = compute_post_sale_date(s.get("sale_date", ""))
        if "post_sale_contacted" not in s:
            update["post_sale_contacted"] = False
        if update:
            await db.sales.update_one({"id": s["id"]}, {"$set": update})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
