const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentAccessControl", function () {
  it("should grant and revoke access and respect expiry", async function () {
    const [owner, viewer, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("DocumentAccessControl");
    const dac = await Factory.connect(owner).deploy();
    await dac.deployed();

    const docId = "doc-123";

    // grant access with expiry in 2 seconds
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 2;
    await dac.connect(owner).grantAccess(docId, viewer.address, expiresAt);

    // should have access immediately
    expect(await dac.hasAccess(docId, viewer.address, owner.address)).to.equal(true);

    // revoke access
    await dac.connect(owner).revokeAccess(docId, viewer.address);
    expect(await dac.hasAccess(docId, viewer.address, owner.address)).to.equal(false);

    // grant again and wait for expiry
    await dac.connect(owner).grantAccess(docId, viewer.address, expiresAt);
    expect(await dac.hasAccess(docId, viewer.address, owner.address)).to.equal(true);

    // increase evm time by 3 seconds
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");

    expect(await dac.hasAccess(docId, viewer.address, owner.address)).to.equal(false);
  });
});
