// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentINFT.sol";

contract AgentINFTTest is Test {
    AgentINFT nft;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        nft = new AgentINFT();
        vm.deal(bob, 10 ether);
    }

    function test_MintBlank() public {
        vm.prank(alice);
        uint256 id = nft.mint("Atlas");
        assertEq(nft.ownerOf(id), alice);
        AgentINFT.Agent memory a = nft.getAgent(id);
        assertEq(a.version, 0);
        assertEq(a.intelligence, 0);
        assertEq(a.origin, alice);
        assertEq(bytes(a.stateRoot).length, 0);
    }

    function test_EvolveBumpsVersionAndState() public {
        vm.startPrank(alice);
        uint256 id = nft.mint("Atlas");
        nft.evolve(id, "0xroot_v1", 35);
        nft.evolve(id, "0xroot_v2", 60);
        vm.stopPrank();
        AgentINFT.Agent memory a = nft.getAgent(id);
        assertEq(a.version, 2);
        assertEq(a.intelligence, 60);
        assertEq(a.stateRoot, "0xroot_v2");
        assertGt(a.trainedAt, 0);
    }

    function test_EvolveOnlyOwner() public {
        vm.prank(alice);
        uint256 id = nft.mint("Atlas");
        vm.prank(bob);
        vm.expectRevert("not owner");
        nft.evolve(id, "0xroot", 10);
    }

    function test_IntelligenceCap() public {
        vm.startPrank(alice);
        uint256 id = nft.mint("Atlas");
        vm.expectRevert("intelligence > 100");
        nft.evolve(id, "0xroot", 101);
        vm.stopPrank();
    }

    function test_SaleTransfersTrainedStateAndPays() public {
        // Alice mints + trains
        vm.startPrank(alice);
        uint256 id = nft.mint("Atlas");
        nft.evolve(id, "0xsmart_root", 88);
        nft.list(id, 1 ether);
        vm.stopPrank();

        uint256 aliceBefore = alice.balance;

        // Bob buys
        vm.prank(bob);
        nft.buy{value: 1 ether}(id);

        // ownership + intelligence travel together
        assertEq(nft.ownerOf(id), bob);
        AgentINFT.Agent memory a = nft.getAgent(id);
        assertEq(a.stateRoot, "0xsmart_root");
        assertEq(a.intelligence, 88);
        assertEq(a.origin, alice, "origin trainer preserved for royalties");

        // seller paid, listing cleared
        assertEq(alice.balance, aliceBefore + 1 ether);
        assertEq(nft.listingPrice(id), 0);
    }

    function test_BuyRefundsOverpay() public {
        vm.startPrank(alice);
        uint256 id = nft.mint("Atlas");
        nft.list(id, 1 ether);
        vm.stopPrank();

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        nft.buy{value: 1.5 ether}(id);
        // bob paid exactly 1 ether (0.5 refunded)
        assertEq(bob.balance, bobBefore - 1 ether);
    }

    function test_NoRoyaltyOnFirstSale() public {
        vm.startPrank(alice);
        uint256 id = nft.mint("Atlas");
        nft.list(id, 1 ether);
        vm.stopPrank();

        uint256 aliceBefore = alice.balance;
        vm.prank(bob);
        nft.buy{value: 1 ether}(id);
        // alice is both seller and origin -> she gets the full price, no split
        assertEq(alice.balance, aliceBefore + 1 ether);
    }

    function test_RoyaltyToOriginOnResale() public {
        address carol = address(0xCA401);
        vm.deal(carol, 10 ether);

        // alice (origin) mints, lists, bob buys (first sale, no royalty)
        vm.startPrank(alice);
        uint256 id = nft.mint("Atlas");
        nft.evolve(id, "0xsmart", 90);
        nft.list(id, 1 ether);
        vm.stopPrank();
        vm.prank(bob);
        nft.buy{value: 1 ether}(id);

        // bob resells to carol -> origin (alice) earns 5%
        vm.prank(bob);
        nft.list(id, 2 ether);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(carol);
        nft.buy{value: 2 ether}(id);

        uint256 royalty = (2 ether * nft.ROYALTY_BPS()) / 10_000; // 0.1 ether
        assertEq(alice.balance, aliceBefore + royalty, "origin royalty");
        assertEq(bob.balance, bobBefore + (2 ether - royalty), "seller net");
        assertEq(nft.ownerOf(id), carol);
        // intelligence still travels
        assertEq(nft.getAgent(id).intelligence, 90);
    }

    function test_CannotBuyUnlisted() public {
        vm.prank(alice);
        uint256 id = nft.mint("Atlas");
        vm.prank(bob);
        vm.expectRevert("not listed");
        nft.buy{value: 1 ether}(id);
    }
}
