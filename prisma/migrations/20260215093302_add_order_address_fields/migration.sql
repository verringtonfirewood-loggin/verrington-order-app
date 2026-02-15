-- DropIndex
DROP INDEX `Product_createdAt_idx` ON `Product`;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Product_isActive_sortOrder_idx` ON `Product`(`isActive`, `sortOrder`);
