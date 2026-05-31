const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { getAddress, parseGwei } = require("viem");

describe("Lock", function () {
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

    const lockedAmount = parseGwei("1");
    const unlockTime = BigInt((await time.latest()) + ONE_YEAR_IN_SECS);

    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const lock = await hre.viem.deployContract("Lock", [unlockTime], {
      value: lockedAmount,
    });

    const publicClient = await hre.viem.getPublicClient();

    return {
      lock,
      unlockTime,
      lockedAmount,
      owner,
      otherAccount,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.read.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the right owner", async function () {
      const { lock, owner } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.read.owner()).to.equal(
        getAddress(owner.account.address),
      );
    });

    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount, publicClient } = await loadFixture(
        deployOneYearLockFixture,
      );

      expect(
        await publicClient.getBalance({ address: lock.address }),
      ).to.equal(lockedAmount);
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      const latestTime = BigInt(await time.latest());
      await expect(
        hre.viem.deployContract("Lock", [latestTime], { value: 1n }),
      ).to.be.rejectedWith("Unlock time should be in the future");
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        await expect(lock.write.withdraw()).to.be.rejectedWith(
          "You can't withdraw yet",
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture,
        );

        await time.increaseTo(unlockTime);

        const lockAsOtherAccount = await hre.viem.getContractAt(
          "Lock",
          lock.address,
          { client: { wallet: otherAccount } },
        );
        await expect(lockAsOtherAccount.write.withdraw()).to.be.rejectedWith(
          "You aren't the owner",
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture,
        );

        await time.increaseTo(unlockTime);

        await expect(lock.write.withdraw()).to.be.fulfilled;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount, publicClient } =
          await loadFixture(deployOneYearLockFixture);

        await time.increaseTo(unlockTime);

        const hash = await lock.write.withdraw();
        await publicClient.waitForTransactionReceipt({ hash });

        const withdrawalEvents = await lock.getEvents.Withdrawal();
        expect(withdrawalEvents).to.have.lengthOf(1);
        expect(withdrawalEvents[0].args.amount).to.equal(lockedAmount);
      });
    });
  });
});
