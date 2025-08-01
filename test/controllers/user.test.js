const sinon = require("sinon");
const chai = require("chai");
//const { expect } = chai;
//const proxyquire = require("proxyquire");
const rewire = require("rewire");
// const mongoose = require("mongoose");
// const path = require("path");
// const fs = require("fs");
// const misc = require("../../src/helpers/misc");
const User = require("../../src/models/user.model");
const RefreshToken = require("../../src/models/refreshToken.model");
const Plan = require("../../src/models/plan.model");
const Role = require("../../src/models/role.model");
const userController = rewire("../../src/controllers/user.controller"); // for private functions
const {
  getAllUsersWithTokens,
  getUsers,
  getAllPlans
  // getProduct,
  // getProductImageById,
  // getProductAllTypes,
  // insertProduct,
  // updateProduct,
  // deleteProduct,
  // removeProduct
} = require("../../src/controllers/user.controller");
//const { diacriticMatchRegex, diacriticsRemove } = require("../../src/helpers/misc");
const config = require("../../src/config");

describe("User Controller", () => {
  let req, res, next;
  let userFindStub, userSaveStub, userDeleteStub, userUpdateStub, userFindOneStub, refreshTokenFindStub, planFindStub;

  beforeEach(() => {
    // create fresh stubs before each test
    userFindStub = sinon.stub(User, "find");
    userSaveStub = sinon.stub(User.prototype, "save");
    userDeleteStub = sinon.stub(User, "deleteMany");
    userUpdateStub = sinon.stub(User, "updateMany");
    userFindOneStub = sinon.stub(User, "findOne");
    refreshTokenFindStub = sinon.stub(RefreshToken, "find");
    planFindStub = sinon.stub(Plan, "find");
    
    req = {
      parameters: {},
      body: {},
      t: (key, params) => {
        // simple translation mock
        return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
      },
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore(); // Clean up after each test
  });

  describe("getAllUsersWithTokens", () => {
    it("should return all users with tokens", async () => {
      const mockUsers = [
        { _id: "1", firstName: "Alice", email: "alice@mail.com" },
        { _id: "2", firstName: "Bob", email: "bob@mail.com" },
      ];
      const mockTokens = []; // Add mock refresh tokens if needed
    
      // Stub User.find()
      const userFindChain = {
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(), // called twice in implementation
        lean: sinon.stub().resolves(mockUsers) // no exec() needed as lean() returns a promise
      };
      userFindStub.returns(userFindChain);
    
      // Stub RefreshToken.find()
      const tokenFindChain = {
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockTokens)
      };
      refreshTokenFindStub.returns(tokenFindChain);
    
      await getAllUsersWithTokens(req, res, next);
    
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        users: mockUsers,
      }));
    });
  });

  describe("getUsers", () => {
    it("should return users with default filter", async () => {
      const mockUsers = [
        { _id: "1", firstName: "Alice" },
        { _id: "2", firstName: "Bob" }
      ];

      // Setup method chaining stub
      const findChain = {
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(), // called twice
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockUsers)
      };
      userFindStub.returns(findChain);

      await getUsers(req, res, next);

      // Verify database call
      sinon.assert.calledWith(userFindStub, {});
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, { users: mockUsers });
    });

    it("should return users with custom filter", async () => {
      const mockUsers = [{ _id: "1", firstName: "Alice" }];
      req.parameters.filter = { active: true };

      const findChain = {
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockUsers)
      };
      userFindStub.returns(findChain);

      await getUsers(req, res, next);

      sinon.assert.calledWith(userFindStub, { active: true });
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, { users: mockUsers });
    });

    it("should return 400 if filter is not an object", async () => {
      req.parameters.filter = "invalid-filter";

      await getUsers(req, res, next);

      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        message: "A filter must be an object"
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database failure");
      
      userFindStub.returns({
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(dbError)
      });

      await getUsers(req, res, next);

      sinon.assert.calledWith(next, sinon.match.instanceOf(Error));
      sinon.assert.calledWithMatch(next, sinon.match.has("message", "Error getting all users: Database failure"));
    });
  });

  describe("getAllPlans", () => {
    it("should return plans sorted by pricePerYear (first test)", async () => {
      const mockPlans = [
        { name: "Basic", pricePerYear: 99 },
        { name: "Premium", pricePerYear: 199 }
      ];

      const query = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis()
      };
      planFindStub.returns({
        ...query,
        then: (fn) => fn(mockPlans)
      });

      await getAllPlans(req, res, next);

      sinon.assert.calledWith(planFindStub, {});
      sinon.assert.calledWith(query.select, ["name", "supportTypes", "priceCurrency", "pricePerYear"]);
      sinon.assert.calledWith(res.status, 200);
    });

    it("should return plans sorted by pricePerYear (second test)", async () => {
      const mockPlans = [];
      const query = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis()
      };
      planFindStub.returns({
        ...query,
        then: (fn) => fn(mockPlans)
      });

      await getAllPlans(req, res, next);

      sinon.assert.calledWith(planFindStub, {});
      sinon.assert.calledWith(query.sort, { pricePerYear: 1 });
      sinon.assert.calledWith(res.json, { plans: mockPlans });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Connection timeout");
      
      // Create a fully stubbed query chain
      const query = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        then: sinon.stub().callsArgWith(1, dbError) // Call error handler
      };
      
      planFindStub.returns(query);
    
      await getAllPlans(req, res, next);
    
      // Verifications
      sinon.assert.calledWithMatch(
        next, 
        sinon.match.has('message', 'Error getting all plans: Connection timeout')
      );
      sinon.assert.notCalled(res.status);
      sinon.assert.notCalled(res.json);
    });
  });
});


/*
describe("User Controller", () => {
  let req, res, next;
  let userFindStub, userSaveStub, userDeleteStub, userUpdateStub, userFindOneStub, refreshTokenFindStub, planFindStub;

  beforeEach(() => {
    // reset stubs and mocks before each test
    userFindStub = sinon.stub(User, "find");
    userSaveStub = sinon.stub(User.prototype, "save");
    userDeleteStub = sinon.stub(User, "deleteMany");
    userUpdateStub = sinon.stub(User, "updateMany");
    userFindOneStub = sinon.stub(User, "findOne");
    refreshTokenFindStub = sinon.stub(RefreshToken, "find");
    planFindStub = sinon.stub(Plan, "find");

    // create mock request, response, and next function
    req = {
      parameters: {},
      body: {},
      t: (key, params) => {
        // simple translation mock
        return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
      },
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      sendFile: sinon.stub().returnsThis()
    };

    next = sinon.stub();
  });

  afterEach(() => {
    // restore all stubs
    console.log("RESTORE.....................");
    sinon.restore();
  });

  describe("getAllUsersWithTokens", () => {
    it("should return all users with tokens", async () => {
      const mockUsers = [
        { _id: "1", firstName: "Alice", email: "alice@mail.com" },
        { _id: "2", firstName: "Bob", email: "bob@mail.com" },
      ];
      const mockTokens = []; // Add mock refresh tokens if needed
    
      // Stub User.find()
      const userFindChain = {
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(), // called twice in implementation
        lean: sinon.stub().resolves(mockUsers) // no exec() needed as lean() returns a promise
      };
      userFindStub.returns(userFindChain);
    
      // Stub RefreshToken.find()
      const tokenFindChain = {
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockTokens)
      };
      refreshTokenFindStub.returns(tokenFindChain);
    
      await getAllUsersWithTokens(req, res, next);
    
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        users: mockUsers,
      }));
    });
  });

  describe("getUsers", () => {
    it("should return users with default filter", async () => {
      const mockUsers = [
        { _id: "1", firstName: "Alice" },
        { _id: "2", firstName: "Bob" }
      ];

      // Setup method chaining stub
      const findChain = {
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(), // called twice
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockUsers)
      };
      userFindStub.returns(findChain);

      await getUsers(req, res, next);

      // Verify database call
      sinon.assert.calledWith(userFindStub, {});
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, { users: mockUsers });
    });

    it("should return users with custom filter", async () => {
      const mockUsers = [{ _id: "1", firstName: "Alice" }];
      req.parameters.filter = { active: true };

      const findChain = {
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockUsers)
      };
      userFindStub.returns(findChain);

      await getUsers(req, res, next);

      sinon.assert.calledWith(userFindStub, { active: true });
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, { users: mockUsers });
    });

    it("should return 400 if filter is not an object", async () => {
      req.parameters.filter = "invalid-filter";

      await getUsers(req, res, next);

      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, {
        message: "A filter must be an object"
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database failure");
      
      userFindStub.returns({
        select: sinon.stub().returnsThis(),
        populate: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(dbError)
      });

      await getUsers(req, res, next);

      sinon.assert.calledWith(next, sinon.match.instanceOf(Error));
      sinon.assert.calledWithMatch(next, sinon.match.has("message", "Error getting all users: Database failure"));
    });
  });

  describe("getAllPlans", () => {
    it("should return plans sorted by pricePerYear in ascending order 1", async () => {
      const mockPlans = [
        { name: "Basic", pricePerYear: 99 },
        { name: "Premium", pricePerYear: 199 }
      ];

      // Create a Promise chain stub
      const query = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis()
      };
      planFindStub.returns({
        ...query,
        then: (fn) => fn(mockPlans) // Immediately resolve with mock data
      });

      await getAllPlans(req, res, next);

      // Verify calls
      sinon.assert.calledWith(planFindStub, {});
      sinon.assert.calledWith(query.select, ["name", "supportTypes", "priceCurrency", "pricePerYear"]);
      sinon.assert.calledWith(query.sort, { pricePerYear: 1 });
      
      // Verify response
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, { plans: mockPlans });
    });

    it("should return plans sorted by pricePerYear in ascending order", async () => {
      const mockPlans = [
        { name: "Basic", pricePerYear: 99 },
        { name: "Premium", pricePerYear: 199 }
      ];

      // Create a Promise chain stub
      const query = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis()
      };
      planFindStub.returns({
        ...query,
        then: (fn) => fn(mockPlans) // Immediately resolve with mock data
      });

      await getAllPlans(req, res, next);

      // Verify calls
      sinon.assert.calledWith(planFindStub, {});
      sinon.assert.calledWith(query.select, ["name", "supportTypes", "priceCurrency", "pricePerYear"]);
      sinon.assert.calledWith(query.sort, { pricePerYear: 1 });
      
      // Verify response
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, { plans: mockPlans });
    });

    // it("should return empty array if no plans exist", async () => {
    //   const mockPlans = [];
      
    //   const findChain = {
    //     select: sinon.stub().returnsThis(),
    //     sort: sinon.stub().returnsThis(),
    //     then: sinon.stub().resolves(mockPlans)
    //   };
    //   userFindStub.returns(findChain);

    //   await getAllPlans(req, res, next);

    //   sinon.assert.calledWith(res.status, 200);
    //   sinon.assert.calledWith(res.json, { plans: [] });

    //   // Create a Promise chain stub
    //   const query = {
    //     select: sinon.stub().returnsThis(),
    //     sort: sinon.stub().returnsThis(),
    //     then: (fn) => Promise.resolve(fn(mockPlans))
    //   };
    //   planFindStub.returns({query});

    //   await getAllPlans(req, res, next);

    //   // Verify calls
    //   sinon.assert.calledWith(planFindStub, {});
    //   sinon.assert.calledWith(query.select, ["name", "supportTypes", "priceCurrency", "pricePerYear"]);
    //   sinon.assert.calledWith(query.sort, { pricePerYear: 1 });
      
    //   // Verify response
    //   sinon.assert.calledWith(res.status, 200);
    //   sinon.assert.calledWith(res.json, { plans: mockPlans });
    // });

    it("should handle database errors", async () => {
      const dbError = new Error("Connection timeout");
      
      const findChain = {
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        then: sinon.stub().rejects(dbError)
      };
      userFindStub.returns(findChain);

      await getAllPlans(req, res, next);

      // Verify error handling
      sinon.assert.calledWithMatch(next, sinon.match.instanceOf(Error));
      sinon.assert.calledWithMatch(
        next, 
        sinon.match.has(
          "message", 
          "Error getting all plans: Connection timeout"
        )
      );
      sinon.assert.notCalled(res.status);
      sinon.assert.notCalled(res.json);
    });
  });


});
*/


/*
    it("should handle error with wrong filter", async () => {
      req.parameters.filter = "WRONG_FILTER";
      
      const mockUsers = [
        { _id: "1", make: "Toyota", models: "Corolla" },
        { _id: "2", make: "Toyota", models: "Camry" }
      ];

      // create a stub that returns a mock with method chaining
      const findChain = {
        collation: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockUsers)
      };
      userFindStub.returns(findChain);

      const countChain = {
        collation: sinon.stub().resolves(2)
      };
      countDocumentsStub.returns(countChain);

      await getUsers(req, res, next);

      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("A filter must be an object")
      }));
    });

    it("should handle error with null filter", async () => {
      req.parameters.filter = { key: "" };
      
      const mockUsers = [
        { _id: "1", make: "Toyota", models: "Corolla" },
        { _id: "2", make: "Toyota", models: "Camry" }
      ];

      // create a stub that returns a mock with method chaining
      const findChain = {
        collation: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockUsers)
      };
      userFindStub.returns(findChain);

      const countChain = {
        collation: sinon.stub().resolves(2)
      };
      countDocumentsStub.returns(countChain);

      await getUsers(req, res, next);
      console.log("RES:", res);

      sinon.assert.calledWith(res.status, 200);
      // sinon.assert.calledWith(res.json, sinon.match({
      //   message: sinon.match("A filter must be an object")
      // }));
    });

    describe("Users options searchable is true", () => {
      let req, res, next, Userstub, nextErrorStub, getUsers;
  
      beforeEach(() => {
        // mock request, response, and next function
        req = {
          parameters: {
            filter: { make: "Toyota" }
          },
          t: sinon.stub().returnsArg(0),
          restrictUsers: 0  // Add restrictUsers
        };
        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis()
        };
  
        next = sinon.stub();

        nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
          const error = new Error(message);
          error.status = status;
          error.stack = stack;
          next(error);
        });

        Userstub = {
          countDocuments: sinon.stub().returns({ collation: sinon.stub().resolves(1) }), // Mock countDocuments
          find: sinon.stub().returns({  // Mock find
            collation: sinon.stub().returnsThis(),
            limit: sinon.stub().returnsThis(),
            select: sinon.stub().returnsThis(),
            lean: sinon.stub().returnsThis(),
            exec: sinon.stub().resolves([]) // Resolve with an empty array by default
          }),
          schema: {
            path: sinon.stub().returns({
              options: {
                searchable: true  // Simulate the key being searchable
              }
            })
          }
        };
  
        // Use proxyquire to inject the stubs
        getUsers = proxyquire("../../src/controllers/product.controller", {
          "../models/product.model": Userstub,
          "../helpers/misc": { nextError: nextErrorStub, diacriticMatchRegex, diacriticsRemove },
          "../config": config
        }).getUsers;
      });
  
      afterEach(() => {
        sinon.restore();
      });
  
      it("should apply diacriticMatchRegex when searchable is true", async () => {
        req.parameters.filter = { make: "Toyota" };

        // mock diacriticMatchRegex to verify it"s called with correct arguments
        const diacriticMatchRegexStub = sinon.stub().returns("regex_pattern");
        proxyquire.load("../../src/controllers/product.controller", {
          "../models/product.model": Userstub,
          "../helpers/misc": { nextError: nextErrorStub, diacriticMatchRegex: diacriticMatchRegexStub, diacriticsRemove },
          "../config": config
        });

        // stub Product.schema.path to return searchable: true
        Userstub.schema.path.withArgs("make").returns({
          options: {
            searchable: true
          }
        });

        await getUsers(req, res, next);

        sinon.assert.called(Userstub.schema.path);
        expect(Userstub.find.calledOnce).to.be.true;
      });

      it("should apply escapedValue when searchable is false", async () => {
        req.parameters.filter = { make: "[" };

        // mock diacriticMatchRegex to verify it"s called with correct arguments
        const escapedValueStub = sinon.stub().returns("[");
        proxyquire.load("../../src/controllers/product.controller", {
          "../models/product.model": Userstub,
          "../helpers/misc": { nextError: nextErrorStub },
          "../config": config
        });

        // stub Product.schema.path to return searchable: true
        Userstub.schema.path.withArgs("make").returns({
          options: {
            searchable: false
          }
        });

        await getUsers(req, res, next);

        sinon.assert.called(Userstub.schema.path);
        expect(Userstub.find.calledOnce).to.be.true;
      });
    });




    describe("error in getUsers", () => {
      let req, res, next, Userstub, nextErrorStub, getUsers;

      beforeEach(() => {
        req = {
          parameters: {
            filter: { make: "Toyota" }
          },
          t: (key, params) => {
            return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
          },
          restrictUsers: 0,
        };
    
        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis()
        };
    
        next = sinon.stub();
    
        nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
          const error = new Error(message);
          error.status = status;
          error.stack = stack;
          next(error);
        });
    
        Userstub = {
          countDocuments: sinon.stub().returns({ collation: sinon.stub().resolves(1) }), // mock countDocuments
          find: sinon.stub().returns({ // mock find
            collation: sinon.stub().returnsThis(),
            limit: sinon.stub().returnsThis(),
            select: sinon.stub().returnsThis(),
            lean: sinon.stub().returnsThis(),
            exec: sinon.stub()
          })
        };
    
        // use proxyquire to inject the stubs
        getUsers = proxyquire("../../src/controllers/product.controller", {
          "../../src/models/product.model": Userstub,
          "../../src/helpers/misc": { nextError: nextErrorStub }
        }).getUsers;
      });
    
      afterEach(() => {
        sinon.restore();
      });
    
      it("should handle error getting Users", async () => {
        const mockError = new Error("Bang!");
        Userstub.countDocuments.returns({ collation: sinon.stub().rejects(mockError) });
    
        await getUsers(req, res, next);
    
        sinon.assert.calledOnce(Userstub.countDocuments);
        sinon.assert.calledOnce(nextErrorStub);
        sinon.assert.calledWith(nextErrorStub, next, "Error getting Users: Bang!", 500, mockError.stack);
      });
    });
  });

  describe("getProduct", () => {
    it("should return product by valid ID", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "MDA-001",
        make: "Toyota",
        models: "Corolla"
      };

      sinon.stub(mongoose, "isValidObjectId").returns(true);
      userFindOneStub.resolves(mockProduct);

      await getProduct(req, res, next);

      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        product: sinon.match({
          id: mockProductId,
          mdaCode: mockProduct.mdaCode,
          make: mockProduct.make,
          models: mockProduct.models,
        })
      }));
    });

    it("should handle invalid product ID", async () => {
      req.parameters.productId = "invalid-id";

      sinon.stub(mongoose, "isValidObjectId").returns(false);

      await getProduct(req, res, next);

      sinon.assert.calledWith(next, sinon.match.instanceOf(Error));
    });

    describe("error in getProduct", () => {
      let req, res, next, Userstub, nextErrorStub, getProduct, mongooseStub;
    
      beforeEach(() => {
        // mock request, response, and next function
        req = {
          parameters: {
            productId: new mongoose.Types.ObjectId().toString()
          },
          t: (key, params) => {
            return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
          }
        };
    
        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis()
        };
    
        next = sinon.stub();
    
        // stub nextError
        nextErrorStub = sinon.stub().callsFake((next, message, status) => {
          const error = new Error(message);
          error.status = status;
          return next(error);
        });
    
        // stub Product.findOne
        Userstub = {
          findOne: sinon.stub()
        };
    
        // stub mongoose.isValidObjectId
        mongooseStub = {
          isValidObjectId: sinon.stub().returns(true) // default to valid
        };
    
        // proxy the product controller
        getProduct = proxyquire("../../src/controllers/product.controller", {
          "../../src/models/product.model": Userstub,
          "../../src/helpers/misc": { nextError: nextErrorStub },
          "mongoose": mongooseStub // mock the mongoose module
        }).getProduct;
      });
    
      afterEach(() => {
        sinon.restore();
      });
    
      it("should handle error getting product", async () => {
        const mockError = new Error("Bang!");
        Userstub.findOne.rejects(mockError);
    
        await getProduct(req, res, next);
    
        sinon.assert.calledOnce(Userstub.findOne);
        sinon.assert.calledOnce(nextErrorStub);
    
        sinon.assert.calledWith(
          nextErrorStub,
          next,
          `Error getting product: ${mockError.message}`,
          500,
          mockError.stack
        );
      });
    });

  });

  describe("getProductImageById", () => {
    it("should serve existing image", () => {
      req.parameters.imageId = "test-image.jpg";
      
      const mockImagePath = path.join(__dirname, "..", "..", "src", "controllers", "images", "test-image.jpg");
      
      sinon.stub(fs, "existsSync").returns(true);
  
      getProductImageById(req, res);
  
      sinon.assert.calledWith(res.sendFile, mockImagePath);
    });
  
    it("should return 404 for non-existing image", () => {
      req.parameters.imageId = "non-existing.jpg";
      
      sinon.stub(fs, "existsSync").returns(false);
  
      getProductImageById(req, res);
  
      sinon.assert.calledWith(res.status, 404);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("Image by id non-existing.jpg not found")
      }));
    });
  });

  describe("getProductAllTypes", () => {
    it("should return predefined product types", () => {
      getProductAllTypes(req, res);

      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        types: ["motorino", "alternatore"]
      });
    });
  });
  
  describe("insertProduct", () => {
    it("should insert a new product successfully", async () => {
      const newProduct = { make: "Toyota", models: "Corolla" };
      req.parameters.product = newProduct;

      await insertProduct(req, res, next);

      sinon.assert.called(userSaveStub);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        message: "Product has been inserted"
      }));
    });

    it("should handle missing product data", async () => {
      await insertProduct(req, res, next);

      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: "Please specify a product"
      }));
    });

    describe("save in insert", () => {
      let req, res, next, ProductMock, nextErrorStub, insertProduct;
    
      beforeEach(() => {
        // mock request, response, and next function
        req = {
          parameters: {
            product: { make: "Inserted Toyota" }
          },
          t: (key, params) => {
            return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
          }
        };
    
        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis()
        };
    
        next = sinon.stub();
    
        // Stub nextError
        nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
          const error = new Error(message);
          error.status = status;
          error.stack = stack;
          return next(error);
        });
    
        // Mock Product constructor
        ProductMock = sinon.stub();
        ProductMock.prototype.save = sinon.stub(); // Add save method to the prototype
    
        // Proxy the product controller
        insertProduct = proxyquire("../../src/controllers/product.controller", {
          "../../src/models/product.model": ProductMock,
          "../../src/helpers/misc": { nextError: nextErrorStub }
        }).insertProduct;
      });
    
      afterEach(() => {
        sinon.restore();
      });
    
      it("should handle error saving product to insert", async () => {
        const mockError = new Error("Bang!");
        ProductMock.prototype.save.rejects(mockError); // Mock save method to reject
    
        await insertProduct(req, res, next);
    
        // Verify that the Product constructor was called with the correct arguments
        sinon.assert.calledOnce(ProductMock);
        sinon.assert.calledWith(ProductMock, { make: "Inserted Toyota" });
    
        // Verify that the save method was called
        sinon.assert.calledOnce(ProductMock.prototype.save);
    
        // Verify that nextError was called with the correct arguments
        sinon.assert.calledOnce(nextErrorStub);
        sinon.assert.calledWith(
          nextErrorStub,
          next,
          "Error saving product to insert: Bang!",
          500,
          mockError.stack
        );
      });
    });
  });

  describe("updateProduct", () => {
    it("should update existing product", async () => {
      const productId = new mongoose.Types.ObjectId();
      req.parameters.productId = productId;
      req.parameters.product = { make: "Updated Toyota" };

      const mockProduct = {
        _id: productId,
        make: "Original Toyota",
        save: userSaveStub
      };

      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.called(userSaveStub);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        product: sinon.match({ make: "Updated Toyota" })
      }));
    });

    it("should handle non-existing product", async () => {
      const productId = new mongoose.Types.ObjectId();
      req.parameters.productId = productId;
      req.parameters.product = { make: "Updated Toyota" };

      userFindOneStub.resolves(null);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: "Product not found"
      }));
    });

    it("should handle valid mdaCode property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = 123;
      req.parameters.product = { mdaCode: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.mdaCode).to.equal(newPropertyValue);
    });

    it("should handle invalid mdaCode property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { mdaCode: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid oemCode property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = 456;
      req.parameters.product = { oemCode: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        oemCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.oemCode).to.equal(newPropertyValue);
    });

    it("should handle invalid oemCode property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { oemCode: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid make property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "FIAT";
      req.parameters.product = { make: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        make: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.make).to.equal(newPropertyValue);
    });

    it("should handle invalid make property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { make: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid models property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "500, Panda";
      req.parameters.product = { models: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        models: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.models).to.equal(newPropertyValue);
    });

    it("should handle invalid models property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { models: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid application property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "500, Panda";
      req.parameters.product = { application: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        application: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.application).to.equal(newPropertyValue);
    });

    it("should handle invalid application property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { application: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid kw property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = 2;
      req.parameters.product = { kw: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        kw: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.kw).to.equal(newPropertyValue);
    });

    it("should handle invalid kw property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { kw: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid volt property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = 12;
      req.parameters.product = { volt: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        volt: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.volt).to.equal(newPropertyValue);
    });

    it("should handle invalid volt property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { volt: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid ampere property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = 120;
      req.parameters.product = { ampere: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        ampere: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.ampere).to.equal(newPropertyValue);
    });

    it("should handle invalid ampere property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { ampere: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid teeth property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = 11;
      req.parameters.product = { teeth: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        teeth: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.teeth).to.equal(newPropertyValue);
    });

    it("should handle invalid teeth property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { teeth: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid rotation property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "destra"; 
      req.parameters.product = { rotation: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        rotation: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.rotation).to.equal(newPropertyValue);
    });

    it("should handle invalid rotation property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { rotation: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid regulator property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "esterno"; 
      req.parameters.product = { regulator: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        regulator: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.regulator).to.equal(newPropertyValue);
    });

    it("should handle invalid regulator property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { regulator: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid type property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "motorino"; 
      req.parameters.product = { type: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        type: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.type).to.equal(newPropertyValue);
    });

    it("should handle invalid type property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { type: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle valid notes property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = "Bla bla bla"; 
      req.parameters.product = { notes: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        notes: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledOnce(mockProduct.save);
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({ product: mockProduct }));
      expect(mockProduct.notes).to.equal(newPropertyValue);
    });

    it("should handle invalid notes property update", async () => {
      const mockProductId = new mongoose.Types.ObjectId();
      req.parameters.productId = mockProductId;
      const newPropertyValue = new Error("invalid");
      req.parameters.product = { notes: newPropertyValue };

      const mockProduct = {
        _id: mockProductId,
        mdaCode: "OLD_VALUE",
        save: sinon.stub().resolves(),
      };
      userFindOneStub.resolves(mockProduct);

      await updateProduct(req, res, next);

      sinon.assert.calledWith(userFindOneStub, { _id: mockProductId });
      sinon.assert.calledWith(res.status, 400);
      sinon.assert.calledWith(res.json, sinon.match({
        message: sinon.match("property is not valid")
      }));
    }); 

    it("should handle error finding product to update", async () => {
      const mockError = new Error("Bang!");
      userFindOneStub.rejects(mockError);
  
      sinon.stub(misc, "nextError").callsFake((next, message, status, stack) => {
        const error = new Error(message);
        error.status = status;
        error.stack = stack;
        return next(error);
      });
  
      const productId = new mongoose.Types.ObjectId();
      req.parameters.productId = productId;
      req.parameters.product = { make: "Updated Toyota" };
  
      await updateProduct(req, res, next);
  
      sinon.assert.calledOnce(userFindOneStub);
      sinon.assert.calledWith(userFindOneStub, { _id: productId });
      sinon.assert.calledOnce(next);
      expect(next.args[0][0].message).to.equal("Error finding product to update: Bang!");
      expect(next.args[0][0].status).to.equal(500);
      expect(next.args[0][0].stack).to.equal(mockError.stack);
    });

    describe("save in update", () => {
      let req, res, next, Userstub, nextErrorStub, updateProduct, mockProduct;

      beforeEach(() => {
        // mock request, response, and next function
        req = {
          parameters: {
            productId: new mongoose.Types.ObjectId(),
            product: { make: "Updated Toyota" }
          },
          body: {},
          t: (key, params) => {
            return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
          },
          restrictUsers: 0
        };

        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis(),
          sendFile: sinon.stub().returnsThis()
        };

        next = sinon.stub();

        // stub nextError
        nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
          const error = new Error(message);
          error.status = status;
          error.stack = stack;
          return next(error);
        });

        // define mockProduct with save method
        mockProduct = {
          _id: req.parameters.productId,
          mdaCode: "MDA-001",
          make: "Toyota",
          models: "Corolla",
          save: sinon.stub()
        };

        // stub Product.findOne
        Userstub = {
          findOne: sinon.stub().resolves(mockProduct)  // findOne resolves with the mockProduct
        };

        // proxy the product controller
        updateProduct = proxyquire("../../src/controllers/product.controller", {
          "../../src/models/product.model": Userstub,
          "../../src/helpers/misc": { nextError: nextErrorStub }
        }).updateProduct;
      });

      afterEach(() => {
        sinon.restore();
      });

      it("should handle error saving product to update", async () => {
        const mockError = new Error("Bang!");
        Userstub.findOne.resolves({ save: sinon.stub().rejects(mockError) });

        await updateProduct(req, res, next);

        sinon.assert.calledOnce(Userstub.findOne);
        sinon.assert.calledOnce(nextErrorStub);
        sinon.assert.calledWith(nextErrorStub,
          next,
          "Error saving product to update: Bang!",
          500,
          mockError.stack
        );
      });
    });

  });
  
  describe("deleteProduct", () => {
    it("should delete Users by filter", async () => {
      req.parameters.filter = ["1", "2"];

      userDeleteStub.resolves({ deletedCount: 2 });

      await deleteProduct(req, res, next);

      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        message: "2 product(s) have been deleted",
        count: 2
      }));
    });

    it("should handle no Users deleted", async () => {
      req.parameters.filter = ["1", "2"];

      userDeleteStub.resolves({ deletedCount: 0 });

      await deleteProduct(req, res, next);

      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, sinon.match({
        message: "No product has been deleted"
      }));
    });
    
    describe("delete all Users", () => {
      let req, res, next, Userstub, nextErrorStub, deleteProduct;
    
      beforeEach(() => {
        req = {
          parameters: {},
          t: sinon.stub().returnsArg(0)
        };
    
        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis()
        };
    
        next = sinon.stub();
    
        nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
          const error = new Error(message);
          error.status = status;
          error.stack = stack;
          next(error);
        });
    
        Userstub = {
          deleteMany: sinon.stub().resolves({ deletedCount: 0 }) // Default: no Users deleted
        };
    
        deleteProduct = proxyquire("../../src/controllers/product.controller", {
          "../../src/models/product.model": Userstub,
          "../../src/helpers/misc": { nextError: nextErrorStub }
        }).deleteProduct;
      });
    
      afterEach(() => {
        sinon.restore();
      });
    
      it("should delete all Users when filter is "*"", async () => {
        req.parameters.filter = "*";
    
        await deleteProduct(req, res, next);
    
        sinon.assert.calledOnce(Userstub.deleteMany);
        sinon.assert.calledWith(Userstub.deleteMany, {}); // Verify filter is {}
        sinon.assert.calledWith(res.status, 200);
        sinon.assert.calledWith(res.json, sinon.match({ message: "No product has been deleted" }));
      });

      it("should handle an Object filter", async () => {
        req.parameters.filter = {};
  
        await deleteProduct(req, res, next);
      });
  
    });

    describe("error in delete", () => {
      let req, res, next, Userstub, nextErrorStub, deleteProduct;
    
      beforeEach(() => {
        req = {
          parameters: {
            filter: ["1", "2"]
          },
          //t: sinon.stub().returnsArg(0)
          t: (message, params = {}) => message.replace("{{count}}", params.count ?? "").replace("{{err}}", params.err ?? "")
        };
    
        res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub().returnsThis()
        };
    
        next = sinon.stub();
    
        nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
          const error = new Error(message);
          error.status = status;
          error.stack = stack;
          next(error);
        });
    
        Userstub = {
          deleteMany: sinon.stub()
        };
    
        deleteProduct = proxyquire("../../src/controllers/product.controller", {
          "../../src/models/product.model": Userstub,
          "../../src/helpers/misc": { nextError: nextErrorStub }
        }).deleteProduct;
      });
    
      afterEach(() => {
        sinon.restore();
      });
    
      it("should handle error deleting Users", async () => {
        const mockError = new Error("Bang!");
        Userstub.deleteMany.rejects(mockError);
    
        await deleteProduct(req, res, next);
    
        sinon.assert.calledOnce(Userstub.deleteMany);
        sinon.assert.calledOnce(nextErrorStub);
    
        sinon.assert.calledWith(
          nextErrorStub,
          next,
          `Error deleting product(s): ${mockError.message}`,
          500,
          mockError.stack
        );
    
        sinon.assert.calledOnce(next);
      });
    });
  });

  describe("removeProduct", () => {
    let req, res, next;
  
    beforeEach(() => {
      req = {
        parameters: {},
        t: (message, params = {}) => message.replace("{{count}}", params.count ?? "").replace("{{err}}", params.err ?? "")
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      next = sinon.stub();
    });
  
    afterEach(() => {
      sinon.restore();
    });
  
    it("should handle error removing Users", async () => {
      const mockError = new Error("Bang!");
      userUpdateStub.rejects(mockError);
  
      sinon.stub(misc, "nextError").callsFake((next, message, status, stack) => {
        const error = new Error(message);
        error.status = status;
        error.stack = stack;
        return next(error);
      });
  
      req.parameters.filter = ["1", "2"];
  
      await removeProduct(req, res, next);
  
      sinon.assert.calledOnce(userUpdateStub);
      sinon.assert.calledWith(userUpdateStub, { _id: { $in: ["1", "2"] } }, { isDeleted: true }, { new: true, lean: true });
      sinon.assert.calledOnce(next);
      expect(next.args[0][0].message).to.equal("Error updating product to remove: Bang!");
      expect(next.args[0][0].status).to.equal(500);
      expect(next.args[0][0].stack).to.equal(mockError.stack);
    });

    it("should handle an Object filter", async () => {
      req.parameters.filter = {};

      await removeProduct(req, res, next);
    });


    it("should return success when Users are removed", async () => {
      // stub updateMany to return modifiedCount: 2
      userUpdateStub.resolves({
        acknowledged: true,
        modifiedCount: 2,
      });
    
      req.parameters.filter = ["valid_id1", "valid_id2"];
      
      await removeProduct(req, res, next);
    
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        message: "2 product(s) have been removed",
        count: 2
      });
    });

    it("should return success when filter is \"*\"", async () => {
      // stub updateMany to return modifiedCount: 2
      userUpdateStub.resolves({
        acknowledged: true,
        modifiedCount: 2,
      });
    
      req.parameters.filter = "*";
      
      await removeProduct(req, res, next);
    
      sinon.assert.calledWith(res.status, 200);
      sinon.assert.calledWith(res.json, {
        message: "2 product(s) have been removed",
        count: 2
      });
    });

    it("should return error if no filter is specified", async () => {
      delete req.parameters.filter;
      
      await removeProduct(req, res, next);
    
      sinon.assert.calledWith(res.status, 400);
      // sinon.assert.calledWith(res.json, {
      //   message: "No product has been removed"
      // });
      sinon.assert.calledWith(
        res.json,
        sinon.match({
          message: "Filter must be specified and be "*" or a filter object or an array of ids"
        })
      );
    });

    it("should return error if filter is not valid", async () => {
      req.parameters.filter = "wrong_filter_type";
      
      await removeProduct(req, res, next);
    
      sinon.assert.calledWith(res.status, 400);
      // sinon.assert.calledWith(res.json, {
      //   message: "No product has been removed"
      // });
      sinon.assert.calledWith(
        res.json,
        sinon.match({
          message: "Filter must be specified and be "*" or a filter object or an array of ids"
        })
      );
    });

    it("should return error when no Users are removed", async () => {
      // stub updateMany to return modifiedCount: 0
      userUpdateStub.resolves({
        acknowledged: true,
        modifiedCount: 0,
      });
    
      req.parameters.filter = ["non_existent_id"];
      
      await removeProduct(req, res, next);
    
      sinon.assert.calledWith(res.status, 400);
      // sinon.assert.calledWith(res.json, {
      //   message: "No product has been removed"
      // });
      sinon.assert.calledWith(
        res.json,
        sinon.match({
          message: "No Users have been removed"
        })
      );
    });
  });



  describe("uploadProductImage", () => {
    let req, res, next, Userstub, mockImageConvert, mockImageWatermark, nextErrorStub, uploadProductImage, validJpegBuffer;

    beforeEach(() => {
      // Create a valid JPEG buffer
      validJpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x00, 0x00, 0x64,
        0x00, 0x64, 0x00, 0x00, 0xFF, 0xEC, 0x00, 0x11, 0x44, 0x75, 0x63, 0x6B, 0x79, 0x00, 0x01, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xEE, 0x00, 0x0E, 0x41, 0x64, 0x6F, 0x62, 0x65,
        0x00, 0x64, 0xC0, 0x00, 0x00, 0x00, 0x01, 0xFF, 0xDB, 0x00, 0x84, 0x00, 0x1B, 0x1A, 0x1A, 0x29,
        0x1D, 0x29, 0x41, 0x26, 0x26, 0x41, 0x42, 0x2F, 0x2F, 0x2F, 0x42, 0x47, 0x3F, 0x3E, 0x3E, 0x3F,
        0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47,
        0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47,
        0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x01, 0x1D, 0x29, 0x29,
        0x34, 0x26, 0x34, 0x3F, 0x28, 0x28, 0x3F, 0x47, 0x3F, 0x35, 0x3F, 0x47, 0x47, 0x47, 0x47, 0x47,
        0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47,
        0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47,
        0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0x47, 0xFF, 0xC0, 0x00,
        0x11, 0x08, 0x00, 0x08, 0x00, 0x19, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x61, 0x00, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x02, 0x05, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x04, 0x10, 0x00, 0x02,
        0x02, 0x02, 0x02, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02,
        0x11, 0x03, 0x00, 0x41, 0x21, 0x12, 0xF0, 0x13, 0x04, 0x31, 0x11, 0x00, 0x01, 0x04, 0x03, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0x31, 0x61, 0x71,
        0xB1, 0x12, 0x22, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F,
        0x00, 0xA1, 0x7E, 0x6B, 0xAD, 0x4E, 0xB6, 0x4B, 0x30, 0xEA, 0xE0, 0x19, 0x82, 0x39, 0x91, 0x3A,
        0x6E, 0x63, 0x5F, 0x99, 0x8A, 0x68, 0xB6, 0xE3, 0xEA, 0x70, 0x08, 0xA8, 0x00, 0x55, 0x98, 0xEE,
        0x48, 0x22, 0x37, 0x1C, 0x63, 0x19, 0xAF, 0xA5, 0x68, 0xB8, 0x05, 0x24, 0x9A, 0x7E, 0x99, 0xF5,
        0xB3, 0x22, 0x20, 0x55, 0xEA, 0x27, 0xCD, 0x8C, 0xEB, 0x4E, 0x31, 0x91, 0x9D, 0x41, 0xFF, 0xD9,
      ]);

      // Mock dependencies
      mockImageConvert = sinon.stub().resolves(validJpegBuffer);
      mockImageWatermark = sinon.stub().resolves(validJpegBuffer);
      nextErrorStub = sinon.stub().callsFake((next, message, status, stack) => {
        const error = new Error(message);
        error.status = status;
        error.stack = stack;
        return next(error);
      });

      Userstub = {
        findOne: sinon.stub()
      };

      // Mock request
      req = {
        file: {
          originalname: "test-image.jpg",
          buffer: validJpegBuffer,
          path: "/path/to/test-image.jpg"
        },
        body: {
          productId: new mongoose.Types.ObjectId().toString()
        },
        t: (key, params) => {
          // simple translation mock
          return params ? key.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p]) : key;
        },
      };

      // Mock response and next
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis()
      };
      next = sinon.stub();

      // Proxy the images helpers and the product controller
      const imageHelpers = proxyquire("../../src/helpers/images", {
        "../helpers/images": {
          imageConvertFormatAndLimitSize: mockImageConvert,
          imageAddWaterMark: mockImageWatermark
        }
      });

      uploadProductImage = proxyquire("../../src/controllers/product.controller", {
        "../helpers/misc": {
          nextError: nextErrorStub
        },
        "../models/product.model": Userstub,
        "../helpers/images": imageHelpers
      }).uploadProductImage;
    });

    afterEach(() => {
      sinon.restore(); // Clean up stubs
    });

    it("should successfully upload product image", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        save: sinon.stub().resolves()
      };
      Userstub.findOne.resolves(mockProduct);

      const req = {
        file: {
          originalname: "test-image.jpg",
          buffer: validJpegBuffer,
          path: "/path/to/test-image.jpg"
        },
        body: {
          productId: mockProduct._id.toString()
        },
        t: sinon.stub().returnsArg(0)
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis()
      };

      const next = sinon.stub();

      await uploadProductImage(req, res, next);

      sinon.assert.calledOnce(Userstub.findOne);
      sinon.assert.calledWith(res.status, 200);
    });

    it("should handle product not found", async () => {
      Userstub.findOne.resolves(null);

      const req = {
        file: {
          originalname: "test-image.jpg",
          buffer: Buffer.from("test image data"),
          path: "/path/to/test-image.jpg"
        },
        body: {
          productId: new mongoose.Types.ObjectId().toString()
        },
        t: sinon.stub().returnsArg(0)
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis()
      };

      const next = sinon.stub();

      await uploadProductImage(req, res, next);

      sinon.assert.calledOnce(Userstub.findOne);
      sinon.assert.calledWith(res.status, 400);
    });

    it("should handle image conversion error", async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(),
        save: sinon.stub().resolves()
      };
      Userstub.findOne.resolves(mockProduct);
      mockImageConvert.rejects(new Error("Conversion failed"));

      const req = {
        file: {
          originalname: "test-image.jpg",
          buffer: Buffer.from("test image data"),
          path: "/path/to/test-image.jpg"
        },
        body: {
          productId: mockProduct._id.toString()
        },
        t: sinon.stub().returnsArg(0)
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis()
      };

      const next = sinon.stub();

      await uploadProductImage(req, res, next);

      //const mockError = new Error("Error");

      sinon.assert.calledOnce(Userstub.findOne);
      sinon.assert.calledOnce(nextErrorStub);

      // verify next was called with the error
      sinon.assert.calledOnce(next);
      expect(next.args[0][0].message).to.equal(
        "Error saving product image: {{err}}"
      );
      expect(next.args[0][0].status).to.equal(500);
    });
    

    it("should handle product find error", async () => {
      const mockError = new Error("Bang!");
      Userstub.findOne.rejects(mockError); // Reject with mock error

      await uploadProductImage(req, res, next);

      // Verify findOne was called
      sinon.assert.calledOnce(Userstub.findOne);

      // Verify nextError was called
      sinon.assert.calledOnce(nextErrorStub);
      sinon.assert.calledWith(
        nextErrorStub,
        next,
        "Error finding product: Bang!",
        500,
        mockError.stack
      );

      // verify next was called with the error
      sinon.assert.calledOnce(next);
      expect(next.args[0][0].message).to.equal(
        "Error finding product: Bang!"
      );
      expect(next.args[0][0].status).to.equal(500);
    });

    it("should handle product save error", async () => {
      const mockError = new Error("Bang!");
      Userstub.findOne.resolves({ save: sinon.stub().rejects(mockError) });

      await uploadProductImage(req, res, next);

      sinon.assert.calledOnce(Userstub.findOne);
      sinon.assert.calledOnce(nextErrorStub);
      sinon.assert.calledWith(nextErrorStub,
          next,
          "Error updating product: Bang!",
          500,
          mockError.stack
      );
    });
  });

  describe("private functions", () => {
    describe("cleanAndPrepareFilterValue", () => {
      it("should clean and prepare filter value", async () => {
        const cleanAndPrepareFilterValue = productController.__get__("cleanAndPrepareFilterValue");
        const { cleanValue, $regexOptions } = await cleanAndPrepareFilterValue("value", config);
        expect(cleanValue).to.equal("value");
      });
      it("should clean and prepare null filter value", async () => {
        const cleanAndPrepareFilterValue = productController.__get__("cleanAndPrepareFilterValue");
        const { cleanValue, $regexOptions } = await cleanAndPrepareFilterValue(null, config);
        expect(cleanValue).to.equal(null);
      });
      it("should clean and prepare filter value with diacritics", async () => {
        const cleanAndPrepareFilterValue = productController.__get__("cleanAndPrepareFilterValue");
        const { cleanValue, $regexOptions } = await cleanAndPrepareFilterValue("ohibò", config);
        expect(cleanValue).to.equal("ohibo");
      });
      it("should clean and prepare filter value with config.db.Users.search.caseInsensitive = true", async () => {
        const cleanAndPrepareFilterValue = productController.__get__("cleanAndPrepareFilterValue");
        config.db.Users.search.caseInsensitive = true;
        const { cleanValue, $regexOptions } = await cleanAndPrepareFilterValue("caseInsensitive", config);
        expect(cleanValue).to.equal("caseInsensitive");
      });
      it("should clean and prepare filter value with config.db.Users.search.caseInsensitive = false", async () => {
        const cleanAndPrepareFilterValue = productController.__get__("cleanAndPrepareFilterValue");
        config.db.Users.search.caseInsensitive = false;
        const { cleanValue, $regexOptions } = await cleanAndPrepareFilterValue("caseInsensitive", config);
        expect(cleanValue).to.equal("caseInsensitive");
      });
    });

    describe("propertyValidate", () => {
      it("should validate a valid property", async () => {
        const propertyValidate = productController.__get__("propertyValidate");

        const result = await propertyValidate(req, "testValue");
        expect(result).to.deep.equal([null, "testValue"]);
      });
      it("should not validate an invalid property", async () => {
        const propertyValidate = productController.__get__("propertyValidate");

        const result = await propertyValidate(req, new Error("invalid"));
        expect(result).to.deep.equal(["property is not valid"]);
      });
    });

    describe("propertyMdaCodeValidate", () => {
      it("should validate property mdaCode", async () => {
        const propertyMdaCodeValidate = productController.__get__("propertyMdaCodeValidate");

        const result = await propertyMdaCodeValidate(req, "testValue");
        expect(result).to.deep.equal([null, "testValue"]);
      });
      it("should not validate an invalid property mdaCode", async () => {
        const propertyMdaCodeValidate = productController.__get__("propertyMdaCodeValidate");

        const result = await propertyMdaCodeValidate(req, new Error("invalid"));
        expect(result).to.deep.equal(["property is not valid"]);
      });
    });
  });
});

*/
