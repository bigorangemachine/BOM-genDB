
module.exports = function(genDB_obj, where_obj){//dependancies and parentOOP protoptype/classes
    var utils=require('bom-utils'),merge=require('merge'),_=require('underscore');
    
    var do_console_err=false,
        do_err=function(input){
            if(do_console_err){
                console.error(input);}
        },
        logic_obj=where_obj.schema(),
        logic_ops=logic_obj.operator_index;
    return {
        'test_least_not':function(doStrip, col){
            where_obj.where_list_unset();
            var logic_not=where_obj.schema(),
                errstr='',
                use_op=(doStrip?utils.check_strip_last(logic_ops.least.base,'()'):logic_ops.least.base);
            //test negative version
            var result_neg=true;
            try{
                result_neg=logic_not.build(col, '!('+use_op+')', 5,10,15,20);
            }catch(e){
                errstr="[TEST_BUILD_LEAST] Could not build '!"+use_op+"'\n"+e.toString();
                do_err(errstr);
            }finally{
                if(result_neg===false){do_err("[TEST_BUILD_LEAST] Could not build '!"+use_op+"'. No reason specified");}
            }
            if(utils.basic_str(errstr)){throw new Error(errstr);}
        },
        'test_least_not_word':function(doStrip, col){
            where_obj.where_list_unset();
            var logic_not_word=where_obj.schema(),
                errstr='',
                use_op=(doStrip?utils.check_strip_last(logic_ops.least.base,'()'):logic_ops.least.base);
            //test negative word version
            var result_neg_word=true;
            try{
                result_neg=logic_not_word.build(col, 'NOT('+use_op+')', 5,10,15,20);
            }catch(e){
                errstr="[TEST_BUILD_LEAST] Could not build 'NOT("+use_op+")'\n"+e.toString();
                do_err(errstr);
            }finally{
                if(result_neg_word===false){do_err("[TEST_BUILD_LEAST] Could not build 'NOT("+use_op+")'. No reason specified");}
            }
            if(utils.basic_str(errstr)){throw new Error(errstr);}
        },
        'test_least_base':function(doStrip, col){
            where_obj.where_list_unset();
            //for(var op in logic_ops){if(utils.obj_valid_key(logic_ops,op)){}}
            var logic_base=where_obj.schema(),
                errstr='',
                use_op=(doStrip?utils.check_strip_last(logic_ops.least.base,'()'):logic_ops.least.base);
            //test intended version
            var result_intended=true;
            try{
                result_intended=logic_base.build(col, use_op, 5,10,15,20);
            }catch(e){
                errstr="[TEST_BUILD_LEAST] Could not build '"+use_op+"'\n"+e.toString();
                do_err(errstr);
            }finally{
                if(result_intended===false){do_err("[TEST_BUILD_LEAST] Could not build '"+use_op+"'. No reason specified");}
            }
            if(utils.basic_str(errstr)){throw new Error(errstr);}
        },
        'test_build_least':function(doStrip){
            this.test_least_base(doStrip, genDB_obj.get_column('id'));
            this.test_least_not(doStrip, genDB_obj.get_column('id'));
            this.test_least_not_word(doStrip, genDB_obj.get_column('id'));
        },
        'test_build_fail':function(doStrip){
            var gen_err=false,
                task_list=['test_least_base','test_least_not','test_least_not_word'];
            do_console_err=false;
            for(var t=0;t<task_list.length;t++){
                if(typeof(this[ task_list[t] ])!=='function'){continue;}
                try{
                    this[ task_list[t] ].apply(this,[doStrip, {}]);
                }catch(e){
                    gen_err=true;
                }
            }
            do_console_err=true;
            if(gen_err===false){
                do_err("[TEST_BUILD_FAIL] Doing a 'build' did not fail when it should have");
            }
        },
        'test_build_with_comp_op':function(doStrip){
            where_obj.where_list_unset();
            var logic_1st=where_obj.schema(),
                logic_2nd=where_obj.schema(),
                comp_1st=where_obj.schema('comp'),
                comp_2nd=where_obj.schema('comp'),
                the_column=genDB_obj.get_column('id');

            logic_1st.build(the_column, '!LEAST', 5,10,15,20);
            where_obj.push(logic_1st);
            comp_1st.build('AND');
            where_obj.push(comp_1st);
            logic_2nd.build(the_column, '>=', 1);
            where_obj.push(logic_2nd);
        },
        'test_build_with_comp_op_fail':function(doStrip){
            where_obj.where_list_unset();
            var gen_err=false,
                logic_1st=where_obj.schema(),
                logic_2nd=where_obj.schema(),
                comp_1st=where_obj.schema('comp'),
                comp_2nd=where_obj.schema('comp'),
                the_column=genDB_obj.get_column('id');

            logic_1st.build(the_column, '!LEAST', 5,10,15,20);
            where_obj.push(logic_1st);
            do_console_err=false;
            try{
                comp_1st.build('FOO');
                where_obj.push(comp_1st);
            }catch(e){
                gen_err=true;
            }
            do_console_err=true;
            if(gen_err===false){
                do_err("[TEST_BUILD_WITH_COMP_OP_FAIL] Doing a 'build' did not fail when it should have");
            }else{
                comp_1st.build('OR');//FAILED THIS MUST BE PROVIDED
                where_obj.push(comp_1st);

                logic_2nd.build(the_column, '>=', 1);
                where_obj.push(logic_2nd);
            }
        }
    };
};
