-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "amenities" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "availabilityStatus" TEXT,
ADD COLUMN     "balconies" INTEGER,
ADD COLUMN     "builtUpArea" DOUBLE PRECISION,
ADD COLUMN     "carpetArea" DOUBLE PRECISION,
ADD COLUMN     "city" TEXT NOT NULL DEFAULT 'Bengaluru',
ADD COLUMN     "dimLength" DOUBLE PRECISION,
ADD COLUMN     "dimWidth" DOUBLE PRECISION,
ADD COLUMN     "electricity" TEXT,
ADD COLUMN     "expectedPrice" DOUBLE PRECISION,
ADD COLUMN     "facing" TEXT,
ADD COLUMN     "floorDetails" TEXT,
ADD COLUMN     "furnishing" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "lift" TEXT,
ADD COLUMN     "locality" TEXT,
ADD COLUMN     "nearbyFacilities" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "negotiable" TEXT,
ADD COLUMN     "ownershipType" TEXT,
ADD COLUMN     "parkingBikes" INTEGER,
ADD COLUMN     "parkingCars" INTEGER,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "plotArea" DOUBLE PRECISION,
ADD COLUMN     "possessionDate" TEXT,
ADD COLUMN     "powerBackup" TEXT,
ADD COLUMN     "propertyAge" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'Sale',
ADD COLUMN     "roadWidth" DOUBLE PRECISION,
ADD COLUMN     "totalFloors" TEXT,
ADD COLUMN     "waterSupply" TEXT;

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "applicantType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'Website',
    "notes" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3),
    "fileUrl" TEXT,

    CONSTRAINT "LoanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");

-- CreateIndex
CREATE INDEX "LoanApplication_phone_idx" ON "LoanApplication"("phone");

-- CreateIndex
CREATE INDEX "LoanApplication_leadId_idx" ON "LoanApplication"("leadId");

-- CreateIndex
CREATE INDEX "LoanApplication_createdAt_idx" ON "LoanApplication"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoanDocument_applicationId_key_key" ON "LoanDocument"("applicationId", "key");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDocument" ADD CONSTRAINT "LoanDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

