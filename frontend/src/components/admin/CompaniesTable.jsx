import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { cn } from '@/lib/utils'
import { WORKSPACE_DATA_TABLE_CLASS } from '../layout/WorkspacePageLayout'
import { Avatar, AvatarImage } from '../ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Edit2, MoreHorizontal } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

const CompaniesTable = () => {
    const { companies, searchCompanyByText } = useSelector(store => store.company);
    const [filterCompany, setFilterCompany] = useState(companies);
    const navigate = useNavigate();
    useEffect(()=>{
        const filteredCompany = companies.length >= 0 && companies.filter((company)=>{
            if(!searchCompanyByText){
                return true
            };
            return company?.name?.toLowerCase().includes(searchCompanyByText.toLowerCase());

        });
        setFilterCompany(filteredCompany);
    },[companies,searchCompanyByText])
    return (
        <div>
            <Table className={cn(WORKSPACE_DATA_TABLE_CLASS, "table-fixed")}>
                <TableCaption>A list of your recent registered companies</TableCaption>
                <colgroup>
                    <col className="w-[12%]" />
                    <col className="w-[48%]" />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                </colgroup>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-left">Logo</TableHead>
                        <TableHead className="text-left">Name</TableHead>
                        <TableHead className="text-left">Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        filterCompany?.map((company) => (
                            <TableRow key={company._id}>
                                <TableCell className="min-w-0">
                                    <Avatar>
                                        <AvatarImage src={company.logo}/>
                                    </Avatar>
                                </TableCell>
                                <TableCell className="min-w-0 truncate font-medium">{company.name}</TableCell>
                                <TableCell className="min-w-0 whitespace-nowrap">{company.createdAt.split("T")[0]}</TableCell>
                                <TableCell className="min-w-0 text-right cursor-pointer">
                                    <Popover>
                                        <PopoverTrigger><MoreHorizontal /></PopoverTrigger>
                                        <PopoverContent className="w-32">
                                            <div onClick={()=> navigate(`/admin/companies/${company._id}`)} className='flex items-center gap-2 w-fit cursor-pointer'>
                                                <Edit2 className='w-4' />
                                                <span>Edit</span>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </TableCell>
                            </TableRow>

                        ))
                    }
                </TableBody>
            </Table>
        </div>
    )
}

export default CompaniesTable